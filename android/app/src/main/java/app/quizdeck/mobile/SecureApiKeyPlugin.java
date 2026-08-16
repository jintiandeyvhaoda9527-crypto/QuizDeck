package app.quizdeck.mobile;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureApiKey")
public class SecureApiKeyPlugin extends Plugin {

    private static final String KEY_STORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "quizdeck_ai_api_key_v1";
    private static final String PREFERENCES = "quizdeck_secure_ai_preferences";
    private static final String CIPHERTEXT = "api_key_ciphertext";
    private static final String IV = "api_key_iv";
    private static final String CONNECTION_BINDING = "api_key_connection_binding";
    private static final int MAX_API_KEY_LENGTH = 8192;
    private static final int MAX_CONNECTION_BINDING_LENGTH = 4096;

    @PluginMethod
    public void save(PluginCall call) {
        String value = call.getString("value");
        String connectionBinding = call.getString("connectionBinding", "");
        if (value == null || value.isBlank() || value.length() > MAX_API_KEY_LENGTH) {
            call.reject("Invalid API key");
            return;
        }
        if (connectionBinding.length() > MAX_CONNECTION_BINDING_LENGTH) {
            call.reject("Invalid API key connection binding");
            return;
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey());
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            SharedPreferences preferences = getPreferences();
            boolean saved = preferences
                .edit()
                .putString(CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .putString(CONNECTION_BINDING, connectionBinding)
                .commit();
            if (!saved) {
                call.reject("Unable to save API key");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to save API key securely");
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        SharedPreferences preferences = getPreferences();
        String encodedCiphertext = preferences.getString(CIPHERTEXT, null);
        String encodedIv = preferences.getString(IV, null);
        String connectionBinding = preferences.getString(CONNECTION_BINDING, "");
        JSObject result = new JSObject();

        if (encodedCiphertext == null || encodedIv == null) {
            result.put("value", "");
            call.resolve(result);
            return;
        }

        try {
            byte[] ciphertext = Base64.decode(encodedCiphertext, Base64.NO_WRAP);
            byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateSecretKey(),
                new GCMParameterSpec(128, iv)
            );
            String value = new String(
                cipher.doFinal(ciphertext),
                StandardCharsets.UTF_8
            );
            result.put("value", value);
            result.put("connectionBinding", connectionBinding);
            call.resolve(result);
        } catch (Exception error) {
            getPreferences()
                .edit()
                .remove(CIPHERTEXT)
                .remove(IV)
                .remove(CONNECTION_BINDING)
                .apply();
            call.reject("Stored API key is no longer available");
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        boolean cleared = getPreferences()
            .edit()
            .remove(CIPHERTEXT)
            .remove(IV)
            .remove(CONNECTION_BINDING)
            .commit();
        if (cleared) {
            call.resolve();
        } else {
            call.reject("Unable to clear API key");
        }
    }

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEY_STORE);
        keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null) {
            return existing;
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            KEY_STORE
        );
        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return generator.generateKey();
    }
}
