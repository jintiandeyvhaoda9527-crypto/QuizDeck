package app.quizdeck.mobile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AiHttp")
public class AiHttpPlugin extends Plugin {

    private static final int MAX_RESPONSE_CHARS = 320_000;
    private static final int MAX_REQUEST_CHARS = 9_100_000;
    private static final int MIN_TIMEOUT_MS = 5_000;
    private static final int MAX_TIMEOUT_MS = 120_000;
    private final ConcurrentHashMap<String, RequestState> requests =
        new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @PluginMethod
    public void request(PluginCall call) {
        String requestId = call.getString("requestId");
        String url = call.getString("url");
        String method = call.getString("method");
        Integer timeoutMs = call.getInt("timeoutMs");
        String body = call.getString("body");
        JSObject headers = call.getObject("headers", new JSObject());

        if (
            requestId == null ||
            requestId.isBlank() ||
            requestId.length() > 128 ||
            url == null ||
            method == null ||
            timeoutMs == null ||
            timeoutMs < MIN_TIMEOUT_MS ||
            timeoutMs > MAX_TIMEOUT_MS ||
            (body != null && body.length() > MAX_REQUEST_CHARS)
        ) {
            call.reject("Invalid AI HTTP request");
            return;
        }

        String normalizedMethod = method.toUpperCase(Locale.ROOT);
        if (!normalizedMethod.equals("GET") && !normalizedMethod.equals("POST")) {
            call.reject("Unsupported AI HTTP method");
            return;
        }
        if (normalizedMethod.equals("POST") && body == null) {
            call.reject("Missing AI HTTP request body");
            return;
        }

        RequestState state = new RequestState();
        if (requests.putIfAbsent(requestId, state) != null) {
            call.reject("Duplicate AI HTTP request id");
            return;
        }
        try {
            executor.execute(() -> executeRequest(
                call,
                requestId,
                state,
                url,
                normalizedMethod,
                headers,
                body,
                timeoutMs
            ));
        } catch (RuntimeException error) {
            requests.remove(requestId, state);
            call.reject("Unable to schedule AI HTTP request");
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestId = call.getString("requestId");
        if (requestId == null || requestId.isBlank()) {
            call.reject("Invalid AI HTTP request id");
            return;
        }
        RequestState state = requests.get(requestId);
        if (state != null) {
            state.cancel();
        }
        call.resolve();
    }

    private void executeRequest(
        PluginCall call,
        String requestId,
        RequestState state,
        String urlValue,
        String method,
        JSObject headers,
        String body,
        int timeoutMs
    ) {
        HttpURLConnection connection = null;
        try {
            if (state.isCancelled()) {
                resolveError(call, "cancelled");
                return;
            }

            URL url = validateUrl(urlValue);
            connection = (HttpURLConnection) url.openConnection();
            if (!state.attach(connection)) {
                resolveError(call, "cancelled");
                return;
            }
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(timeoutMs);
            connection.setReadTimeout(timeoutMs);
            connection.setRequestMethod(method);
            connection.setUseCaches(false);
            connection.setDoInput(true);
            applyHeaders(connection, headers);

            if (state.isCancelled()) {
                connection.disconnect();
                resolveError(call, "cancelled");
                return;
            }

            if (method.equals("POST")) {
                byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(payload.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
            }

            int status = connection.getResponseCode();
            if (state.isCancelled()) {
                resolveError(call, "cancelled");
                return;
            }

            JSObject result = new JSObject();
            result.put("status", status);
            if (status < 200 || status >= 300) {
                // Error bodies can contain provider internals and are never exposed.
                result.put("data", JSObject.NULL);
                call.resolve(result);
                return;
            }

            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > (long) MAX_RESPONSE_CHARS * 4L) {
                resolveError(call, "response-too-large");
                return;
            }
            try (InputStream input = connection.getInputStream()) {
                result.put("data", readResponse(input));
            }
            if (state.isCancelled()) {
                resolveError(call, "cancelled");
                return;
            }
            call.resolve(result);
        } catch (ResponseTooLargeException error) {
            resolveError(call, "response-too-large");
        } catch (SocketTimeoutException error) {
            resolveError(call, "timeout");
        } catch (Exception error) {
            resolveError(
                call,
                state.isCancelled() ? "cancelled" : "network"
            );
        } finally {
            if (connection != null) {
                state.detach(connection);
                connection.disconnect();
            }
            requests.remove(requestId, state);
        }
    }

    private URL validateUrl(String value) throws Exception {
        URL url = new URL(value);
        String protocol = url.getProtocol().toLowerCase(Locale.ROOT);
        String host = url.getHost().toLowerCase(Locale.ROOT);
        boolean loopback =
            host.equals("localhost") ||
            host.equals("127.0.0.1") ||
            host.equals("[::1]") ||
            host.equals("::1");
        if (
            (!protocol.equals("https") && !(protocol.equals("http") && loopback)) ||
            url.getUserInfo() != null ||
            url.getQuery() != null ||
            url.getRef() != null
        ) {
            throw new IllegalArgumentException("Invalid AI HTTP URL");
        }
        return url;
    }

    private void applyHeaders(
        HttpURLConnection connection,
        JSObject headers
    ) throws Exception {
        Iterator<String> names = headers.keys();
        while (names.hasNext()) {
            String name = names.next();
            Object value = headers.opt(name);
            if (value instanceof String text) {
                connection.setRequestProperty(name, text);
            }
        }
    }

    private String readResponse(InputStream input) throws Exception {
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(input, StandardCharsets.UTF_8)
        )) {
            char[] buffer = new char[8_192];
            int count;
            while ((count = reader.read(buffer)) != -1) {
                if (text.length() + count > MAX_RESPONSE_CHARS) {
                    throw new ResponseTooLargeException();
                }
                text.append(buffer, 0, count);
            }
        }
        return text.toString();
    }

    private void resolveError(PluginCall call, String code) {
        JSObject result = new JSObject();
        result.put("errorCode", code);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        for (RequestState state : requests.values()) {
            state.cancel();
        }
        requests.clear();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private static class ResponseTooLargeException extends Exception {}

    private static class RequestState {

        private boolean cancelled;
        private HttpURLConnection connection;

        synchronized boolean attach(HttpURLConnection nextConnection) {
            if (cancelled) {
                nextConnection.disconnect();
                return false;
            }
            connection = nextConnection;
            return true;
        }

        synchronized void cancel() {
            cancelled = true;
            if (connection != null) {
                connection.disconnect();
            }
        }

        synchronized boolean isCancelled() {
            return cancelled;
        }

        synchronized void detach(HttpURLConnection currentConnection) {
            if (connection == currentConnection) {
                connection = null;
            }
        }
    }
}
