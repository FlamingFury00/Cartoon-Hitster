# Keep the JavaScript bridge methods (called by name from the web app).
-keepclassmembers class io.github.flamingfury00.sigleinfila.WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
