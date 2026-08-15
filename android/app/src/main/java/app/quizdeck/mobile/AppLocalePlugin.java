package app.quizdeck.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppLocale")
public class AppLocalePlugin extends Plugin {

    @PluginMethod
    public void getDefaultLocale(PluginCall call) {
        JSObject result = new JSObject();
        result.put("locale", BuildConfig.QUIZDECK_DEFAULT_LOCALE);
        call.resolve(result);
    }
}
