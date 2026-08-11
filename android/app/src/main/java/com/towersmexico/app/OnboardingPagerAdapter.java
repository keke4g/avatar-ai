package com.towersmexico.app;

import android.content.Context;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.recyclerview.widget.RecyclerView;

final class OnboardingPagerAdapter extends RecyclerView.Adapter<OnboardingPagerAdapter.PageViewHolder> {
    static final int PAGE_ETERNA = 0;
    static final int PAGE_EXPLORE = 1;
    static final int PAGE_MICROPHONE = 2;
    static final int PAGE_NOTIFICATIONS = 3;
    static final int PAGE_COUNT = 4;

    private static final int[] PAGE_TITLES = {
        R.string.eterna_title,
        R.string.explore_title,
        R.string.permission_title,
        R.string.notifications_title
    };

    private static final int[] PAGE_ACCENTS = {
        R.string.eterna_title_accent,
        R.string.explore_title_accent,
        R.string.permission_title_accent,
        R.string.notifications_title_accent
    };

    private static final int[] PAGE_BODIES = {
        R.string.eterna_body,
        R.string.explore_body,
        R.string.permission_body,
        R.string.notifications_body
    };

    private static final int[] PAGE_DESCRIPTIONS = {
        R.string.onboarding_page_eterna_description,
        R.string.onboarding_page_explore_description,
        R.string.onboarding_page_permission_description,
        R.string.onboarding_page_notifications_description
    };

    @NonNull
    @Override
    public PageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
            .inflate(R.layout.item_onboarding_page, parent, false);
        return new PageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull PageViewHolder holder, int position) {
        Context context = holder.itemView.getContext();
        String title = context.getString(PAGE_TITLES[position]);
        String accent = context.getString(PAGE_ACCENTS[position]);
        SpannableString styledTitle = new SpannableString(title);
        int accentStart = title.lastIndexOf(accent);
        if (accentStart >= 0) {
            styledTitle.setSpan(
                new ForegroundColorSpan(ContextCompat.getColor(context, R.color.onboarding_blue)),
                accentStart,
                accentStart + accent.length(),
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            );
        }

        holder.title.setText(styledTitle);
        holder.body.setText(PAGE_BODIES[position]);
        holder.itemView.setContentDescription(context.getString(PAGE_DESCRIPTIONS[position]));
        ViewCompat.setAccessibilityHeading(holder.title, true);
    }

    @Override
    public int getItemCount() {
        return PAGE_COUNT;
    }

    static final class PageViewHolder extends RecyclerView.ViewHolder {
        final TextView title;
        final TextView body;

        PageViewHolder(@NonNull View itemView) {
            super(itemView);
            title = itemView.findViewById(R.id.onboarding_page_title);
            body = itemView.findViewById(R.id.onboarding_page_body);
        }
    }
}
