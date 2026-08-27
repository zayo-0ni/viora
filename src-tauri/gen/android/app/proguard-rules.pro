# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# The two bridges the page calls into.
#
# R8 has no way to see that anything uses these: the callers are strings in a
# JavaScript bundle. Android's default rules do keep @JavascriptInterface
# members, but this app cannot afford to find out the hard way — the failure is
# silent, and it takes out the clipboard and the whole native player in a
# release build while the debug build stays perfect.
-keepclassmembers class app.viora.VioraPlayer {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class app.viora.VioraMpv {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class app.viora.MainActivity$ClipboardBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# The mpv library, all of it, because its callers are in C.
#
# This is the same lesson as the bridges above and it cost a great deal more to
# learn. libmpv calls back into Java by name — `MPV.eventProperty(String)` and
# `MPV.eventProperty(String, boolean)` among them — and no Java code calls them
# at all, so R8 concluded they were dead and removed them. The native side then
# looked them up at runtime, did not find them, and the failure was not an
# exception anyone could catch: ART threw NoSuchMethodError, then threw a second
# error on top of the first while it was still pending, and aborted the process
# with SIGABRT. The player took the whole app with it.
#
# Read on the television:
#
#   Abort message: 'Throwing new exception 'no non-static method
#   "Lis/xyz/mpv/MPV;.eventProperty(Ljava/lang/String;Z)V"' with unexpected
#   pending exception: java.lang.NoSuchMethodError'
#
# And this is why it only ever happened on the set: minification runs for
# release builds and not for debug ones, so the emulator was perfect while the
# television crashed on the same code. Anything reached over JNI has to be kept
# by name, and the whole package is kept rather than the two methods that were
# caught, because the next version of the library may call a third.
-keep class is.xyz.mpv.** { *; }
-keepclassmembers class is.xyz.mpv.** {
    native <methods>;
}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile