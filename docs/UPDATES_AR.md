<div align="left"><a href="UPDATES.md">English</a> &nbsp;·&nbsp; <b>العربية</b></div>

<div dir="rtl">

# كيف يتحدّث Viora

لـViora قناتا تحديث مستقلّتان: إصلاحات المزوّدين لا تنتظر إصدارًا جديدًا للتطبيق، وإصدار التطبيق لا يعتمد على تحديث المزوّدين.

| القناة | ما تحتويه | كيف تصلك |
| --- | --- | --- |
| **قائمة المزوّدين** | تكاملات المزوّدين الموجودة وعناوينها وإعداداتها الافتراضية ومعلومات لغاتها | ينزّلها التطبيق ويتحقّق منها دون إعادة تثبيت |
| **إصدارات التطبيق** | ملف APK الخاص بـViora نفسه | تُنشر في [الإصدارات](https://github.com/zayo-0ni/viora/releases) مع بصمة تحقّق وشيفرتها المصدرية |

## قائمة المزوّدين

**مكان النشر**

</div>

```
https://raw.githubusercontent.com/zayo-0ni/viora/main/registry/providers-viora.json
```

<div dir="rtl">

| الملف | الغرض |
| --- | --- |
| `registry/providers-viora.json` | قائمة المزوّدين الموقّعة التي ينزّلها التطبيق |
| `registry/providers-viora.sig` | توقيع Ed25519 نفسه منفصلًا (base64) للتحقّق المستقل |
| `registry/registry-info.json` | رقم الإصدار ووقت الإنشاء وبصمة SHA-256 للقائمة المنشورة |

**ما يفعله التطبيق**

1. تأتي كل نسخة من Viora بقائمة مزوّدين موقّعة مدمجة، فيعمل قبل أي تنزيل.
2. حين يكون خيار **تحديث المزوّدين تلقائياً** مفعّلًا (وهو الافتراضي)، يبحث عن قائمة أحدث عند التشغيل وكل 12 ساعة، ويبحث فورًا حين تنقر **الإعدادات ← VIP Viora ← تحديث المزوّدين**.
3. لا تُقبل القائمة المنزَّلة إلا إذا طابق توقيعُها (Ed25519) المفتاحَ العام المدمج في التطبيق واجتاز محتواها التحقّق، ويجب أن تكون *أحدث* من القائمة الفعّالة، فلا يمكن إعادة تمرير قائمة قديمة.
4. تحلّ القائمة الصالحة محلّ الفعّالة دفعة واحدة، وتُحفظ القائمة الصالحة السابقة؛ فإذا وُجدت القائمة المحفوظة تالفة يومًا، عاد Viora إليها أو إلى القائمة المدمجة.
5. خطأ الشبكة أو التوقيع غير الصالح أو الملف التالف لا يغيّر شيئًا: تبقى القائمة الحالية فعّالة ويُعرض السبب.

قد تحتاج القائمة المنشورة حديثًا إلى نحو خمس دقائق لتصل إلى كل الأجهزة، لأن GitHub يحتفظ بنسخة مؤقتة من الملف طوال هذه المدة.

قائمة المزوّدين بيانات فقط (عناوين وإعدادات افتراضية وأوصاف)، ولا يمكنها إضافة شيفرة برمجية إلى التطبيق. فإذا احتاج مزوّد منطقًا لا يملكه التطبيق المثبَّت، يظهر بحالة **يحتاج تحديث منطق التطبيق** ويبقى متوقفًا حتى يأتي به إصدار جديد.

**صيغة الملف**

</div>

```json
{
  "format": "viora-signed-registry-v1",
  "keyId": "viora-vip-2026-09",
  "payload": "<base64 of the provider list JSON>",
  "signature": "<base64 Ed25519 signature over the decoded payload bytes>"
}
```

<div dir="rtl">

**المفتاح العام** (`viora-vip-2026-09`، مفتاح Ed25519 خام بترميز base64)

</div>

```
9jRWi8mOiMbubjiZ2Cv1uR/JsfOrY41xDjTJ1eW3EoI=
```

<details>
<summary><b>تحقّق من قائمة المزوّدين بنفسك</b></summary>
<br>

```python
# pip install cryptography
import base64, json
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

key = Ed25519PublicKey.from_public_bytes(base64.b64decode("9jRWi8mOiMbubjiZ2Cv1uR/JsfOrY41xDjTJ1eW3EoI="))
envelope = json.load(open("providers-viora.json", encoding="utf-8"))
payload = base64.b64decode(envelope["payload"])
key.verify(base64.b64decode(envelope["signature"]), payload)  # raises InvalidSignature if tampered
print("valid, version", json.loads(payload)["version"])
```

</details>

<div dir="rtl">

## إصدارات التطبيق

يضمّ كل إصدار في [الإصدارات](https://github.com/zayo-0ni/viora/releases):

| الملف | الغرض |
| --- | --- |
| `Viora-<version>.apk` | التطبيق |
| `Viora-<version>-sha256.txt` | بصمات SHA-256 لكل ملفات الإصدار |
| `Viora-<version>-source.zip` | الشيفرة المصدرية المقابلة الكاملة لذلك الـAPK ([التفاصيل](SOURCE_AR.md)) |

ويصف الملف `updates/latest.json` أحدثَ إصدار، وستقرؤه ميزة التحقّق من التحديثات داخل التطبيق حين تصل. صيغته موضّحة في [النسخة الإنجليزية من هذه الصفحة](UPDATES.md#app-releases).

**التحقّق من ملف منزَّل**

</div>

```bash
sha256sum Viora-1.0.0.apk
```

<div dir="rtl">

على ويندوز: `certutil -hashfile Viora-1.0.0.apk SHA256`. يجب أن تطابق النتيجة سطر ذلك الملف في `Viora-<version>-sha256.txt`.

كل ملف APK رسمي موقَّع بمفتاح إصدار Viora نفسه، لذا يُثبَّت الإصدار الأحدث فوق الأقدم مع بقاء بياناتك. ويرفض أندرويد تثبيت APK موقَّع بمفتاح مختلف فوق Viora؛ فإذا حدث ذلك فالملف ليس من هنا.

</div>
