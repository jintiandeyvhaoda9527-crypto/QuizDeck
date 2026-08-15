package app.quizdeck.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureApiKeyPlugin.class);
        registerPlugin(AppLocalePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
