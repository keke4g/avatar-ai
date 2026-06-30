"use client";
import React from "react";
import HeroVideo from "./HeroVideo";
import { useAvatarState } from "../../hooks/useAvatarState";

export default function HomeHero() {
  const avatarState = useAvatarState();

  return (
    <div className="flex flex-col items-center justify-center w-full select-none mt-0 lg:mt-0">
      {/* Vertical video center */}
      <div className="w-full flex justify-center">
        <HeroVideo avatarState={avatarState} />
      </div>
    </div>
  );
}
