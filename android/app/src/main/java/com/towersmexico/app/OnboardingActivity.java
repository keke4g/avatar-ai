package com.towersmexico.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.viewpager2.widget.ViewPager2;

public class OnboardingActivity extends AppCompatActivity {
    private static final String PREFERENCES_NAME = "towers_mobile_preferences";
    private static final String LEGACY_ONBOARDING_COMPLETE_KEY = "microphone_onboarding_complete";
    private static final String ONBOARDING_VERSION_KEY = "completed_onboarding_version";
    private static final String MICROPHONE_REQUESTED_KEY = "microphone_permission_requested";
    private static final String NOTIFICATIONS_REQUESTED_KEY = "notifications_permission_requested";
    private static final int CURRENT_ONBOARDING_VERSION = 4;
    private static final Uri EXPLORE_URI = Uri.parse("https://towersmexico.com/explore");

    private SharedPreferences preferences;
    private ViewPager2 pager;
    private Button primaryButton;
    private Button secondaryButton;
    private TextView permissionStatus;
    private View[] progressBars;
    private Uri pendingDeepLink;
    private int currentPage = OnboardingPagerAdapter.PAGE_ETERNA;
    private boolean openingApplication;

    private final ActivityResultLauncher<String> microphonePermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            updateMicrophoneState();
            if (granted && primaryButton != null) {
                permissionStatus.announceForAccessibility(getString(R.string.microphone_ready));
                primaryButton.postDelayed(() -> {
                    if (!isFinishing() && !isDestroyed()) {
                        pager.setCurrentItem(OnboardingPagerAdapter.PAGE_NOTIFICATIONS, true);
                    }
                }, 300L);
            } else if (permissionStatus != null) {
                permissionStatus.announceForAccessibility(permissionStatus.getText());
            }
        });

    private final ActivityResultLauncher<String> notificationPermissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            preferences.edit().putBoolean(NOTIFICATIONS_REQUESTED_KEY, true).apply();
            if (granted) {
                PropertyPushNotifications.enable(this);
                permissionStatus.setText(R.string.notifications_ready);
                permissionStatus.announceForAccessibility(getString(R.string.notifications_ready));
            }
            primaryButton.postDelayed(() -> {
                if (!isFinishing() && !isDestroyed()) {
                    completeOnboardingAndOpen(null);
                }
            }, 250L);
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pendingDeepLink = destinationFrom(getIntent());
        preferences = getSharedPreferences(PREFERENCES_NAME, MODE_PRIVATE);
        migrateLegacyOnboardingState();
        PropertyPushNotifications.createChannel(this);

        // Authentication, recovery, and property links must never wait behind a tutorial.
        if (pendingDeepLink != null) {
            openApplication(pendingDeepLink);
            return;
        }

        if (isCurrentOnboardingComplete()) {
            openApplication(null);
            return;
        }

        setContentView(R.layout.activity_onboarding);
        configureSystemBars();
        bindViews();
        configurePager(savedInstanceState);
        configureActions();
        playEntranceAnimation();
    }

    private void bindViews() {
        pager = findViewById(R.id.onboarding_pager);
        primaryButton = findViewById(R.id.onboarding_primary_button);
        secondaryButton = findViewById(R.id.onboarding_secondary_button);
        permissionStatus = findViewById(R.id.onboarding_permission_status);
        progressBars = new View[] {
            findViewById(R.id.onboarding_progress_1),
            findViewById(R.id.onboarding_progress_2),
            findViewById(R.id.onboarding_progress_3),
            findViewById(R.id.onboarding_progress_4)
        };
    }

    private void configurePager(Bundle savedInstanceState) {
        pager.setAdapter(new OnboardingPagerAdapter());
        pager.setOffscreenPageLimit(1);
        pager.setPageTransformer((page, position) -> {
            float distance = Math.min(1f, Math.abs(position));
            page.setAlpha(1f - (distance * 0.38f));
            page.setTranslationX(-position * dp(14));
        });

        pager.registerOnPageChangeCallback(new ViewPager2.OnPageChangeCallback() {
            @Override
            public void onPageSelected(int position) {
                currentPage = position;
                updateControlsForPage(position);
            }
        });

        currentPage = savedInstanceState == null
            ? OnboardingPagerAdapter.PAGE_ETERNA
            : savedInstanceState.getInt("onboarding_page", OnboardingPagerAdapter.PAGE_ETERNA);
        pager.setCurrentItem(currentPage, false);
        updateControlsForPage(currentPage);
    }

    private void configureActions() {
        primaryButton.setOnClickListener(view -> handlePrimaryAction());
        secondaryButton.setOnClickListener(view -> handleSecondaryAction());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (currentPage > OnboardingPagerAdapter.PAGE_ETERNA) {
                    pager.setCurrentItem(currentPage - 1, true);
                } else {
                    finish();
                }
            }
        });
    }

    private void handlePrimaryAction() {
        if (currentPage < OnboardingPagerAdapter.PAGE_MICROPHONE) {
            pager.setCurrentItem(currentPage + 1, true);
            return;
        }

        if (currentPage == OnboardingPagerAdapter.PAGE_MICROPHONE) {
            handleMicrophoneAction();
            return;
        }

        handleNotificationsAction();
    }

    private void handleSecondaryAction() {
        if (currentPage == OnboardingPagerAdapter.PAGE_ETERNA) {
            completeOnboardingAndOpen(null);
        } else if (currentPage == OnboardingPagerAdapter.PAGE_EXPLORE) {
            completeOnboardingAndOpen(EXPLORE_URI);
        } else if (currentPage == OnboardingPagerAdapter.PAGE_MICROPHONE) {
            pager.setCurrentItem(OnboardingPagerAdapter.PAGE_NOTIFICATIONS, true);
        } else {
            completeOnboardingAndOpen(null);
        }
    }

    private void handleMicrophoneAction() {
        if (hasMicrophonePermission()) {
            pager.setCurrentItem(OnboardingPagerAdapter.PAGE_NOTIFICATIONS, true);
            return;
        }

        boolean requestedBefore = preferences.getBoolean(MICROPHONE_REQUESTED_KEY, false);
        boolean shouldExplain = ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.RECORD_AUDIO
        );

        if (requestedBefore && !shouldExplain) {
            openApplicationSettings();
            return;
        }

        preferences.edit().putBoolean(MICROPHONE_REQUESTED_KEY, true).apply();
        microphonePermissionLauncher.launch(Manifest.permission.RECORD_AUDIO);
    }

    private void handleNotificationsAction() {
        if (PropertyPushNotifications.canPostNotifications(this)) {
            PropertyPushNotifications.enable(this);
            completeOnboardingAndOpen(null);
            return;
        }

        boolean requestedBefore = preferences.getBoolean(NOTIFICATIONS_REQUESTED_KEY, false);
        boolean shouldExplain = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.shouldShowRequestPermissionRationale(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            );

        if (requestedBefore && !shouldExplain) {
            openNotificationSettings();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS);
        } else {
            preferences.edit().putBoolean(NOTIFICATIONS_REQUESTED_KEY, true).apply();
            PropertyPushNotifications.enable(this);
            completeOnboardingAndOpen(null);
        }
    }

    private void updateControlsForPage(int position) {
        for (int index = 0; index < progressBars.length; index += 1) {
            View progress = progressBars[index];
            ViewGroup.LayoutParams params = progress.getLayoutParams();
            params.width = dp(index == position ? 28 : 5);
            progress.setLayoutParams(params);
            progress.setBackgroundResource(
                index == position
                    ? R.drawable.onboarding_progress_active
                    : R.drawable.onboarding_progress_inactive
            );
            progress.animate().alpha(index == position ? 1f : 0.62f).setDuration(160L).start();
        }

        permissionStatus.setBackground(null);
        permissionStatus.setVisibility(View.GONE);
        primaryButton.setText(R.string.next_step);

        if (position == OnboardingPagerAdapter.PAGE_ETERNA) {
            secondaryButton.setText(R.string.skip_onboarding);
        } else if (position == OnboardingPagerAdapter.PAGE_EXPLORE) {
            secondaryButton.setText(R.string.explore_now);
        } else if (position == OnboardingPagerAdapter.PAGE_MICROPHONE) {
            secondaryButton.setText(R.string.continue_without_voice);
            updateMicrophoneState();
        } else {
            secondaryButton.setText(R.string.continue_without_voice);
            updateNotificationState();
        }
    }

    private void updateMicrophoneState() {
        if (permissionStatus == null || currentPage != OnboardingPagerAdapter.PAGE_MICROPHONE) {
            return;
        }

        if (hasMicrophonePermission()) {
            showPermissionStatus(R.string.microphone_ready, R.color.onboarding_success);
            primaryButton.setText(R.string.next_step);
            return;
        }

        boolean requestedBefore = preferences.getBoolean(MICROPHONE_REQUESTED_KEY, false);
        boolean shouldExplain = ActivityCompat.shouldShowRequestPermissionRationale(
            this,
            Manifest.permission.RECORD_AUDIO
        );

        if (requestedBefore && !shouldExplain) {
            showPermissionStatus(R.string.microphone_open_settings_hint, R.color.onboarding_warning);
            primaryButton.setText(R.string.open_settings);
        } else if (requestedBefore) {
            showPermissionStatus(R.string.microphone_denied_hint, R.color.onboarding_text);
            primaryButton.setText(R.string.retry_microphone);
        } else {
            permissionStatus.setVisibility(View.GONE);
            primaryButton.setText(R.string.enable_microphone);
        }
    }

    private void updateNotificationState() {
        if (permissionStatus == null || currentPage != OnboardingPagerAdapter.PAGE_NOTIFICATIONS) {
            return;
        }

        if (PropertyPushNotifications.canPostNotifications(this)) {
            showPermissionStatus(R.string.notifications_ready, R.color.onboarding_success);
            primaryButton.setText(R.string.enter_app);
            return;
        }

        boolean requestedBefore = preferences.getBoolean(NOTIFICATIONS_REQUESTED_KEY, false);
        boolean shouldExplain = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.shouldShowRequestPermissionRationale(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            );

        if (requestedBefore && !shouldExplain) {
            showPermissionStatus(R.string.notifications_denied_hint, R.color.onboarding_warning);
            primaryButton.setText(R.string.open_settings);
        } else {
            permissionStatus.setVisibility(View.GONE);
            primaryButton.setText(R.string.enable_notifications);
        }
    }

    private void showPermissionStatus(int textResource, int colorResource) {
        permissionStatus.setText(textResource);
        permissionStatus.setTextColor(ContextCompat.getColor(this, colorResource));
        permissionStatus.setVisibility(View.VISIBLE);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri incomingDeepLink = destinationFrom(intent);
        if (incomingDeepLink != null) {
            pendingDeepLink = incomingDeepLink;
            openApplication(incomingDeepLink);
        } else if (preferences != null && isCurrentOnboardingComplete()) {
            openApplication(null);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (primaryButton == null) {
            return;
        }
        if (currentPage == OnboardingPagerAdapter.PAGE_MICROPHONE) {
            updateMicrophoneState();
        } else if (currentPage == OnboardingPagerAdapter.PAGE_NOTIFICATIONS) {
            updateNotificationState();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        outState.putInt("onboarding_page", currentPage);
        super.onSaveInstanceState(outState);
    }

    private void configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(ContextCompat.getColor(this, R.color.onboarding_surface));
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        View root = findViewById(R.id.onboarding_root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    private void playEntranceAnimation() {
        View root = findViewById(R.id.onboarding_root);
        root.setAlpha(0f);
        root.animate().alpha(1f).setDuration(320L).start();
    }

    private void migrateLegacyOnboardingState() {
        if (!preferences.contains(ONBOARDING_VERSION_KEY)
            && preferences.getBoolean(LEGACY_ONBOARDING_COMPLETE_KEY, false)) {
            preferences.edit().putInt(ONBOARDING_VERSION_KEY, 1).apply();
        }
    }

    private boolean isCurrentOnboardingComplete() {
        return preferences.getInt(ONBOARDING_VERSION_KEY, 0) >= CURRENT_ONBOARDING_VERSION;
    }

    private boolean hasMicrophonePermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }

    private Uri destinationFrom(Intent intent) {
        if (intent == null) {
            return null;
        }
        return intent.getData() != null
            ? intent.getData()
            : PropertyPushNotifications.destinationFrom(intent);
    }

    private void openApplicationSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }

    private void openNotificationSettings() {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        startActivity(intent);
    }

    private void completeOnboardingAndOpen(Uri destination) {
        preferences.edit()
            .putInt(ONBOARDING_VERSION_KEY, CURRENT_ONBOARDING_VERSION)
            .putBoolean(LEGACY_ONBOARDING_COMPLETE_KEY, true)
            .apply();
        openApplication(destination);
    }

    private void openApplication(Uri destination) {
        if (openingApplication) {
            return;
        }
        openingApplication = true;

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (destination != null) {
            intent.setData(destination);
        }
        startActivity(intent);
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
