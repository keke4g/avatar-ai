package com.towersmexico.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Logger;
import com.google.firebase.messaging.FirebaseMessaging;

final class PropertyPushNotifications {
    static final String CHANNEL_ID = "new_properties";
    static final String TOPIC = "new-properties";

    private static final String PREFERENCES_NAME = "towers_mobile_preferences";
    private static final String OPTED_IN_KEY = "new_property_notifications_opted_in";
    private static final String APP_ORIGIN = "https://towersmexico.com";
    private static final String UUID_PATTERN =
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";

    private PropertyPushNotifications() {
    }

    static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription(context.getString(R.string.notification_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    static boolean canPostNotifications(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    static void enable(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        preferences.edit().putBoolean(OPTED_IN_KEY, true).apply();
        subscribeToTopic();
    }

    static void refreshSubscriptionIfEnabled(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        if (preferences.getBoolean(OPTED_IN_KEY, false) && canPostNotifications(context)) {
            subscribeToTopic();
        }
    }

    static Uri destinationFrom(Intent intent) {
        if (intent == null) {
            return null;
        }

        String propertyId = intent.getStringExtra("property_id");
        if (propertyId != null && propertyId.matches(UUID_PATTERN)) {
            return Uri.parse(APP_ORIGIN + "/property/" + propertyId);
        }

        String url = intent.getStringExtra("url");
        if (url == null || url.isBlank()) {
            return null;
        }

        Uri candidate = Uri.parse(url);
        String host = candidate.getHost();
        if ("https".equalsIgnoreCase(candidate.getScheme())
            && ("towersmexico.com".equalsIgnoreCase(host)
                || "www.towersmexico.com".equalsIgnoreCase(host))) {
            return candidate;
        }
        return null;
    }

    private static void subscribeToTopic() {
        try {
            FirebaseMessaging.getInstance()
                .subscribeToTopic(TOPIC)
                .addOnFailureListener(error ->
                    Logger.error("Unable to subscribe to new property notifications", error)
                );
        } catch (IllegalStateException error) {
            Logger.error("Firebase is not configured for property notifications", error);
        }
    }
}
