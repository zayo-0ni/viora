<div align="left"><a href="SOURCE.md">English</a> &nbsp;·&nbsp; <b>العربية</b></div>

<div dir="rtl">

# الشيفرة المصدرية المقابلة

Viora مرخَّص بموجب [رخصة جنو العمومية العامة، الإصدار 3](../LICENSE). ولكل ملف APK يُنشر هنا، تُنشر بجانبه في الإصدار نفسه الشيفرةُ المصدرية الكاملة المقابلة لتلك النسخة بعينها:

</div>

```
Viora-<version>.apk
Viora-<version>-source.zip      ← the source code of this APK
Viora-<version>-sha256.txt      ← checksums of both
```

<div dir="rtl">

يُنشأ الأرشيف من الإيداع (commit) نفسه الذي بُني منه الـAPK، ويضمّ كل ما يلزم لبناء التطبيق: شيفرة التطبيق وموارده، وقائمة المزوّدين المدمجة، وسكربتات البناء Gradle ومُشغّلها (wrapper)، وملفات الترخيص والإشعارات.

## ما لا يتضمّنه الأرشيف

لا يُستبعد إلا الأسرار، ولا تُستبعد أي شيفرة:

- مفتاح توقيع إصدارات أندرويد (keystore) وكلمات مروره
- المفتاح الخاص الذي تُوقَّع به قائمة المزوّدين
- مفاتيح الواجهات البرمجية الشخصية وبيانات اعتماد الخدمات المستخدمة في النسخة الرسمية

يقرأ البناء هذه القيم من `local.properties` أو من متغيّرات البيئة، وإذا كانت القيمة فارغة تُخفى الميزة التي تحتاجها أو تُعطَّل، فتُبنى الشيفرة المصدرية دون أيٍّ منها.

## بناء APK إصدار من الأرشيف

المتطلبات: JDK 17 وAndroid SDK (يثبّتهما Android Studio معًا).

1. فكّ ضغط `Viora-<version>-source.zip`.
2. أنشئ الملف `local.properties` في جذر المشروع:

</div>

```properties
sdk.dir=/path/to/Android/Sdk

# Optional: your own TMDB API key (https://www.themoviedb.org/settings/api)
TMDB_API_KEY=

# Optional: your own release signing key
VIORA_RELEASE_STORE_FILE=/path/to/your-release.jks
VIORA_RELEASE_STORE_PASSWORD=
VIORA_RELEASE_KEY_ALIAS=
VIORA_RELEASE_KEY_PASSWORD=
```

<div dir="rtl">

3. ابنِ التطبيق:

</div>

```bash
./gradlew :androidApp:assembleFullRelease
```

<div dir="rtl">

تظهر ملفات APK في `androidApp/build/outputs/apk/full/release/`، وتكون غير موقَّعة إن لم تُعطِ قيم التوقيع، جاهزة لتوقّعها بنفسك. ولبناء تجريبي سريع موقَّع بمفتاح التصحيح في أندرويد استخدم `./gradlew :androidApp:assembleFullDebug`.

الـAPK الذي تبنيه بنفسك يُوقَّع بمفتاحك، فيعدّه أندرويد من ناشر مختلف، ولا يحلّ محلّ التطبيق الرسمي إلا بعد إزالة التطبيق الرسمي.

## الإصدارات السابقة

يحتفظ كل إصدار بأرشيف شيفرته المصدرية. افتح الإصدار في [الإصدارات](https://github.com/zayo-0ni/viora/releases) لتحصل على شيفرة تلك النسخة.

</div>
