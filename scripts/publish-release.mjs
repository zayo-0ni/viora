#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
//  نشر إصدار جديد من Viora إلى GitHub — رقم، بناء، توقيع، رفع
// ══════════════════════════════════════════════════════════════════════════
//  يُشغَّل بالنقر على «نشر_الإصدار.bat».
//
//  ما يفعله بالترتيب، ولا يتقدّم خطوة إن فشلت التي قبلها:
//     ١. يسألك عن رقم الإصدار ويتأكّد أنه أعلى من المنشور وغير مكرّر
//     ٢. يكتبه في الملفات الثلاثة التي يجب أن تتّفق
//     ٣. يبني arm64 موقّعاً
//     ٤. يبني arm32 موقّعاً
//     ٥. يتحقّق أن الاثنين موقّعان بمفتاح الإصدار لا بمفتاح التصحيح
//     ٦. يعرض عليك ما سيُنشر وينتظر تأكيدك
//     ٧. ينشئ الإصدار ويرفع الملفّين
//
//  لا يرفع كوداً مصدرياً — الإصدار ملفّان مبنيّان فقط.
//
//  المخرجات بالإنجليزية عمداً: نافذة cmd لا تعرض العربية بترتيبها الصحيح
//  (تظهر معكوسة الحروف)، فوضوح الرسالة أهمّ من لغتها هنا. التعليقات تبقى
//  عربية لأنها تُقرأ في المحرّر لا في الطرفية.
//
//  التوثيق: عبر `gh auth login` مرة واحدة. لا توكن في ملف ولا في الكود.

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID = join(ROOT, "src-tauri", "gen", "android");
const STAGE = join(ROOT, "src-tauri", "gen", "android", "release-staging");

/**
 * ما يُرفع، وبأي اسم.
 *
 * اسم arm64 ثابت بلا رقم إصدار عن قصد: رابط
 * `releases/latest/download/Viora-android.apk` في README هو ما يكتبه المستخدم
 * في تطبيق Downloader مرة واحدة، وهو يعمل فقط ما دام الملف يحمل هذا الاسم
 * بالضبط في كل إصدار. تسميته باسم يحمل الرقم تكسر الرابط عند كل نشر.
 */
const TARGETS = [
  {
    arch: "arm64",
    asset: "Viora-android.apk",
    label: "arm64-v8a — modern boxes and televisions",
  },
  {
    arch: "arm",
    asset: "Viora-android-arm32.apk",
    label: "armeabi-v7a — older 32-bit boxes",
  },
];

const BAR = "-".repeat(62);
const say = (m = "") => process.stdout.write(m + "\n");

function die(msg) {
  say();
  say("  [FAILED] " + msg);
  say();
  process.exit(1);
}

function step(n, title) {
  say();
  say(BAR);
  say(`  STEP ${n}/7 - ${title}`);
  say(BAR);
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: "pipe", ...opts });
}

/**
 * Runs a Windows batch wrapper.
 *
 * `apksigner` ships as apksigner.bat, and since the fix for CVE-2024-27980
 * Node refuses to hand a .bat or .cmd to execFile at all — it throws EINVAL
 * before the process ever starts, because the shell would reparse the
 * arguments. cmd.exe has to be the thing being executed, with the batch file
 * as its argument.
 *
 * The arguments are quoted individually rather than joined into one string:
 * the SDK lives under a user profile, and any account whose name has a space
 * in it would otherwise split the path in half.
 */
function runBat(bat, args) {
  if (process.platform !== "win32") return sh(bat, args);
  // Backslashes, not the forward slashes Node is happy with: cmd.exe reads a
  // leading forward slash as the start of a switch and answers "The filename,
  // directory name, or volume label syntax is incorrect."
  const win = (p) => p.replace(/\//g, "\\");
  const inner = [win(bat), ...args.map(win)].map((a) => `"${a}"`).join(" ");
  // The outer pair is required, not belt-and-braces. When the string after /c
  // begins with a quote, cmd strips the first and last quote of the whole line
  // and runs what is left — so `"tool" "a" "b"` becomes `tool" "a" "b`, which
  // is why this first failed with "The filename, directory name, or volume
  // label syntax is incorrect". With /s and an outer pair, cmd removes exactly
  // that pair and takes the rest verbatim. See `cmd /?`.
  return sh(process.env.COMSPEC || "cmd.exe", ["/d", "/s", "/c", `"${inner}"`], {
    windowsVerbatimArguments: true,
  });
}

// ── أدوات الإصدار ────────────────────────────────────────────────────────────

const VERSION_RE = /^\d+\.\d+\.\d+$/;

/** يقارن كأرقام لا كنصوص: "1.0.10" أعلى من "1.0.9" رغم أن النص يقول العكس. */
function cmpVersion(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

function currentVersion() {
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

/**
 * الملفات الثلاثة التي يوجب BUILDING.md اتّفاقها.
 *
 * `tauri.properties` ليس منها: يكتبه build-apk.mjs من package.json عند كل
 * بناء، فيتبع هذا تلقائياً.
 */
function writeVersion(v) {
  const pkgPath = join(ROOT, "package.json");
  const pkg = readFileSync(pkgPath, "utf8");
  writeFileSync(pkgPath, pkg.replace(/("version":\s*)"[^"]+"/, `$1"${v}"`));

  const cargoPath = join(ROOT, "src-tauri", "Cargo.toml");
  const cargo = readFileSync(cargoPath, "utf8");
  writeFileSync(cargoPath, cargo.replace(/^version = "[^"]+"/m, `version = "${v}"`));

  const confPath = join(ROOT, "src-tauri", "tauri.conf.json");
  const conf = readFileSync(confPath, "utf8");
  writeFileSync(confPath, conf.replace(/("version":\s*)"[^"]+"/, `$1"${v}"`));
}

// ── التوقيع ─────────────────────────────────────────────────────────────────

function findApksigner() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
  const dir = join(sdk, "build-tools");
  if (!existsSync(dir)) return null;
  const versions = readdirSync(dir).sort().reverse();
  for (const v of versions) {
    const p = join(dir, v, process.platform === "win32" ? "apksigner.bat" : "apksigner");
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * يتأكّد أن الملف موقّع بمفتاح الإصدار.
 *
 * هذا الفحص ليس احتياطياً زائداً. `app/build.gradle.kts` يسقط إلى مفتاح
 * التصحيح حين لا يجد keystore.properties:
 *     signingConfig = signingConfigs.findByName("release")
 *         ?: signingConfigs.getByName("debug")
 * فالبناء ينجح ويخرج APK يبدو سليماً وهو موقّع بمفتاح كل حاسوب فيه Android
 * Studio. ولو نُشر، لعجز كل من ثبّته عن تحديثه لاحقاً بالمفتاح الحقيقي —
 * أندرويد يرفض استبدال توقيع بآخر، ولا حلّ إلا حذف التطبيق وفقدان المكتبة.
 */
function assertReleaseSigned(apk, apksigner) {
  let out;
  try {
    out = runBat(apksigner, ["verify", "--print-certs", apk]);
  } catch (e) {
    die(`apksigner could not verify ${apk}\n     ${(e.stderr || e.message || "").toString().slice(0, 400)}`);
  }
  const dn = /certificate DN:\s*(.+)/i.exec(out)?.[1]?.trim() ?? "";
  if (!dn) die(`${apk} carries no signature at all.`);
  if (/Android Debug/i.test(dn)) {
    die(`${apk} is signed with the DEBUG key.\n` +
        `     keystore.properties was not found or is incomplete, so Gradle fell\n` +
        `     back. Publishing this would lock every installer out of future\n` +
        `     updates. Fix ${join(ANDROID, "keystore.properties")} and retry.`);
  }
  return dn;
}

// ── الخطوات ─────────────────────────────────────────────────────────────────

async function main() {
  say();
  say("=".repeat(62));
  say("  Viora - Publish Release");
  say("=".repeat(62));

  // البيئة قبل أي عمل: الفشل هنا مجاني، وبعد بناءين يكلّف عشرين دقيقة.
  try {
    sh("gh", ["auth", "status"], { stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    die("Not signed in to GitHub.\n\n" +
        "     Run this once, then start again:\n" +
        "         gh auth login");
  }
  if (!existsSync(join(ANDROID, "keystore.properties"))) {
    die("No keystore.properties in " + ANDROID + "\n" +
        "     Release builds would be signed with the debug key.");
  }
  const apksigner = findApksigner();
  if (!apksigner) die("apksigner not found. Install Android SDK build-tools.");

  // ── ١. رقم الإصدار ──
  // يُسأل قبل البناء لا بعده: لو جاء متأخّراً لبُني كل شيء ثم تبيّن أن الرقم
  // مرفوض، فيضيع البناء بلا داعٍ.
  step(1, "Version");

  let published = [];
  try {
    published = JSON.parse(sh("gh", ["release", "list", "--limit", "100", "--json", "tagName"]))
      .map((r) => r.tagName.replace(/^v/, ""))
      .filter((v) => VERSION_RE.test(v));
  } catch (e) {
    die("Cannot read the published releases.\n     " + (e.stderr || e.message || "").toString().slice(0, 300));
  }
  const highest = published.sort(cmpVersion).at(-1) ?? "0.0.0";
  const current = currentVersion();

  say();
  say(`  Published on GitHub : ${published.length ? "v" + highest : "(none yet)"}`);
  say(`  In the source tree  : ${current}`);
  say();

  const answer = await ask("  New version (e.g. 1.0.3): ");
  const version = answer.replace(/^v/i, "").trim();

  if (!VERSION_RE.test(version)) die(`"${answer}" is not major.minor.patch`);
  if (published.includes(version)) {
    die(`v${version} is already published.\n     Published: ${published.slice(-5).map((v) => "v" + v).join(", ")}`);
  }
  if (cmpVersion(version, highest) <= 0) {
    die(`v${version} is not higher than the published v${highest}.\n` +
        `     Android refuses an update whose versionCode is not greater, so\n` +
        `     nobody on v${highest} would ever be offered this build.`);
  }
  const tag = "v" + version;
  say();
  say(`  OK - publishing ${tag}`);

  // ── ٢. كتابة الرقم ──
  step(2, "Writing the version");
  writeVersion(version);
  say(`  package.json, Cargo.toml, tauri.conf.json  ->  ${version}`);
  say("  tauri.properties follows at build time.");

  // ── ٣ و ٤. البناءان ──
  // الويب يُبنى مع أول معمارية فقط؛ الثانية تعيد استعمال dist نفسه، وهو ما
  // يوفّر دقائق ويضمن أن الملفّين يحملان الواجهة ذاتها بالضبط.
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });

  const built = [];
  for (const [i, t] of TARGETS.entries()) {
    step(3 + i, `Building ${t.arch} (release, signed)`);
    say("  This takes a few minutes...");
    const args = ["scripts/build-apk.mjs", "--release", "--arch", t.arch];
    if (i > 0) args.push("--skip-web");
    const p = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
    if (p.status !== 0) die(`The ${t.arch} build failed - see the output above.`);

    const out = join(ANDROID, "app", "build", "outputs", "apk", t.arch, "release", `app-${t.arch}-release.apk`);
    if (!existsSync(out)) die(`expected ${out}`);
    const staged = join(STAGE, t.asset);
    copyFileSync(out, staged);
    built.push({ ...t, path: staged, size: statSync(staged).size });
    say();
    say(`  OK - ${t.asset}  (${(statSync(staged).size / 1024 / 1024).toFixed(1)} MB)`);
  }

  // ── ٥. التحقّق من التوقيع ──
  step(5, "Verifying signatures");
  const dns = new Set();
  for (const b of built) {
    const dn = assertReleaseSigned(b.path, apksigner);
    dns.add(dn);
    say(`  ${b.asset}`);
    say(`    signed by ${dn}`);
  }
  // اختلاف المفتاحين يعني أن أحد البنائين التقط إعداداً آخر — وهو ما ينتج
  // إصداراً نصفه غير قابل للتحديث عند نصف المستخدمين.
  if (dns.size > 1) die("The two APKs are signed with different keys.");

  // ── ٦. التأكيد ──
  step(6, "Review");
  say();
  say(`  Tag       : ${tag}`);
  say(`  Repository: ${sh("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]).trim()}`);
  say();
  for (const b of built) {
    say(`  ${b.asset.padEnd(28)} ${(b.size / 1024 / 1024).toFixed(1).padStart(6)} MB   ${b.label}`);
  }
  say();
  say("  Nothing else is uploaded - no source, no keystore.");
  say();
  const go = await ask('  Publish? type "yes" to continue: ');
  if (go.toLowerCase() !== "yes") {
    say();
    say("  Cancelled. The version files were already updated; commit or revert them yourself.");
    say();
    process.exit(0);
  }

  // ── ٧. النشر ──
  step(7, "Publishing");
  const notes =
    `Android TV build ${version}.\n\n` +
    `| File | For |\n| --- | --- |\n` +
    TARGETS.map((t) => `| \`${t.asset}\` | ${t.label} |`).join("\n") +
    `\n\nIn the Downloader app:\n\n` +
    `\`\`\`\ngithub.com/zainzainalaa-commits/viora/releases/latest/download/Viora-android.apk\n\`\`\`\n\n` +
    `That address always resolves to the newest build, so it only has to be typed once.`;

  const p = spawnSync("gh", [
    "release", "create", tag,
    "--title", tag,
    "--notes", notes,
    ...built.map((b) => b.path),
  ], { cwd: ROOT, stdio: "inherit" });
  if (p.status !== 0) die("gh release create failed - see the output above.");

  say();
  say(BAR);
  say(`  Published ${tag}`);
  say(BAR);
  say();
  say("  Remember to commit the version bump:");
  say(`      git commit -am "Release ${tag}"`);
  say();
}

main().catch((e) => die(e?.stack || String(e)));
