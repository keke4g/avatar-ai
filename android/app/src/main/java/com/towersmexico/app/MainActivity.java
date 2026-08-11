package com.towersmexico.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import com.getcapacitor.WebViewListener;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends BridgeActivity {
    private static final String APP_ORIGIN = "https://towersmexico.com";
    private static final Set<String> TRUSTED_APP_ORIGINS = new HashSet<>(Arrays.asList(
        "https://towersmexico.com",
        "https://www.towersmexico.com"
    ));

    /**
     * The web voice hook requests getUserMedia to confirm permission and then
     * starts Web Speech, which opens a second Android AudioRecord through the
     * system recognition service. Some physical devices silence one of those
     * concurrent captures. This document-start guard releases the permission
     * probe immediately before SpeechRecognition starts, including for the
     * already-deployed web bundle.
     */
    private static final String MICROPHONE_CAPTURE_GUARD_SCRIPT = """
        (() => {
          if (window.__towersMicrophoneCaptureGuardInstalled) return;
          window.__towersMicrophoneCaptureGuardInstalled = true;

          const microphoneStreams = new Set();
          const mediaDevices = navigator.mediaDevices;

          if (mediaDevices && typeof mediaDevices.getUserMedia === 'function') {
            const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
            const guardedGetUserMedia = async (...args) => {
              const stream = await originalGetUserMedia(...args);
              if (args[0] && args[0].audio) {
                microphoneStreams.add(stream);
                for (const track of stream.getAudioTracks()) {
                  track.addEventListener('ended', () => {
                    if (stream.getAudioTracks().every(item => item.readyState === 'ended')) {
                      microphoneStreams.delete(stream);
                    }
                  });
                }
              }
              return stream;
            };

            try {
              mediaDevices.getUserMedia = guardedGetUserMedia;
            } catch (_) {
              Object.defineProperty(mediaDevices, 'getUserMedia', {
                configurable: true,
                value: guardedGetUserMedia,
              });
            }
          }

          const releaseCompetingCaptures = () => {
            let released = 0;
            for (const stream of microphoneStreams) {
              for (const track of stream.getAudioTracks()) {
                if (track.readyState === 'live') {
                  track.stop();
                  released += 1;
                }
              }
            }
            microphoneStreams.clear();
            if (released > 0) {
              console.info('[Towers Android] Released permission capture before speech recognition');
            }
          };

          window.__towersReleaseCompetingMicrophones = releaseCompetingCaptures;

          const wrapSpeechRecognition = (propertyName) => {
            const OriginalRecognition = window[propertyName];
            if (typeof OriginalRecognition !== 'function' || OriginalRecognition.__towersGuarded) return;

            const GuardedRecognition = function (...args) {
              const instance = Reflect.construct(OriginalRecognition, args, OriginalRecognition);
              const originalStart = instance.start.bind(instance);
              instance.start = (...startArgs) => {
                releaseCompetingCaptures();
                return originalStart(...startArgs);
              };
              return instance;
            };

            GuardedRecognition.prototype = OriginalRecognition.prototype;
            Object.setPrototypeOf(GuardedRecognition, OriginalRecognition);
            GuardedRecognition.__towersGuarded = true;

            try {
              window[propertyName] = GuardedRecognition;
            } catch (_) {
              Object.defineProperty(window, propertyName, {
                configurable: true,
                value: GuardedRecognition,
              });
            }
          };

          wrapSpeechRecognition('SpeechRecognition');
          wrapSpeechRecognition('webkitSpeechRecognition');
        })();
        """;

    @Override
    protected void load() {
        WebView webView = findViewById(com.getcapacitor.android.R.id.webview);

        if (webView != null && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            try {
                WebViewCompat.addDocumentStartJavaScript(
                    webView,
                    MICROPHONE_CAPTURE_GUARD_SCRIPT,
                    TRUSTED_APP_ORIGINS
                );
            } catch (IllegalArgumentException error) {
                Logger.error("Unable to install Towers microphone guard at document start", error);
            }
        }

        // Fallback for older WebView implementations without document-start
        // script support. The primary path above runs before any page code.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    webView.evaluateJavascript(MICROPHONE_CAPTURE_GUARD_SCRIPT, null);
                }
            }
        });

        super.load();
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PropertyPushNotifications.createChannel(this);
        PropertyPushNotifications.refreshSubscriptionIfEnabled(this);
        openTrustedDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openTrustedDeepLink(intent);
    }

    private void openTrustedDeepLink(Intent intent) {
        if (intent == null || getBridge() == null) {
            return;
        }

        Uri uri = intent.getData() != null
            ? intent.getData()
            : PropertyPushNotifications.destinationFrom(intent);
        if (uri == null) {
            return;
        }
        String targetUrl = null;

        if ("https".equalsIgnoreCase(uri.getScheme()) && isTowersHost(uri.getHost())) {
            targetUrl = uri.toString();
        } else if ("towersmexico".equalsIgnoreCase(uri.getScheme())) {
            StringBuilder path = new StringBuilder();
            if (uri.getHost() != null && !uri.getHost().isBlank()) {
                path.append('/').append(uri.getHost());
            }
            if (uri.getEncodedPath() != null) {
                path.append(uri.getEncodedPath());
            }
            if (path.length() == 0) {
                path.append('/');
            }

            targetUrl = APP_ORIGIN + path;
            if (uri.getEncodedQuery() != null) {
                targetUrl += "?" + uri.getEncodedQuery();
            }
            if (uri.getEncodedFragment() != null) {
                targetUrl += "#" + uri.getEncodedFragment();
            }
        }

        if (targetUrl != null) {
            getBridge().getWebView().loadUrl(targetUrl);
        }
    }

    private boolean isTowersHost(String host) {
        return "towersmexico.com".equalsIgnoreCase(host)
            || "www.towersmexico.com".equalsIgnoreCase(host);
    }
}
