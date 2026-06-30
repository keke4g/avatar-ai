import time
import math
import random
import numpy as np

class ProceduralAnimator:
    """
    Generates realistic, organic facial poses and eye-blinking sways for Eterna.
    Combines multi-frequency harmonics to eliminate mechanical repetition, 
    creating a premium and lively human presence in real-time.
    """
    def __init__(self):
        # Eye blinking state machine
        self.blink_phase = 0          # 0: Open, 1: Closing, 2: Closed, 3: Opening
        self.last_blink_time = time.time()
        self.blink_interval = random.uniform(3.5, 6.0)
        self.blink_start_time = 0.0
        self.eyelid_openness = 1.0     # 1.0 = Fully open, 0.0 = Closed
        
        # Rotations & sways (Smooth EMA dampening)
        self.current_yaw = 0.0
        self.current_pitch = 0.0
        self.current_roll = 0.0
        self.current_trans_x = 0.0
        self.current_trans_y = 0.0
        
    def update_blinking_state(self):
        """State machine for highly natural, multi-frame eye blinks"""
        curr_time = time.time()
        
        if self.blink_phase == 0:
            self.eyelid_openness = 1.0
            if curr_time - self.last_blink_time > self.blink_interval:
                self.blink_phase = 1 # Start closing
                self.blink_start_time = curr_time
                self.blink_interval = random.uniform(3.0, 5.5)
                
        elif self.blink_phase == 1:
            # Closing eye (rapid 40ms transition)
            elapsed = curr_time - self.blink_start_time
            self.eyelid_openness = max(0.0, 1.0 - (elapsed / 0.04))
            if elapsed >= 0.04:
                self.blink_phase = 2 # Fully closed
                self.blink_start_time = curr_time
                
        elif self.blink_phase == 2:
            # Closed eye (held for 70ms to be visible)
            self.eyelid_openness = 0.0
            elapsed = curr_time - self.blink_start_time
            if elapsed >= 0.07:
                self.blink_phase = 3 # Start opening
                self.blink_start_time = curr_time
                
        elif self.blink_phase == 3:
            # Opening eye (rapid 40ms transition)
            elapsed = curr_time - self.blink_start_time
            self.eyelid_openness = min(1.0, elapsed / 0.04)
            if elapsed >= 0.04:
                self.blink_phase = 0 # Open again
                self.last_blink_time = curr_time

    def generate_driving_pose(self, status: str = "idle") -> tuple:
        """
        Computes the complete camera and face coordinates for the warping engine.
        Returns:
        - driving_pose: NumPy array (6,) representing [Yaw, Pitch, Roll, dx, dy, dz]
        - eyelid_coefficient: float representing eye closure to blend with expression
        """
        self.update_blinking_state()
        
        curr_t = time.time()
        
        # AVOID MECHANICAL LOOPS: We combine prime-number frequencies
        # to generate a continuous, non-repeating organic sway pattern.
        # Yaw (left/right head turn): very subtle (max 1.2 degrees)
        target_yaw = (
            math.sin(curr_t * 0.73) * 0.6 + 
            math.sin(curr_t * 0.31) * 0.3 + 
            math.cos(curr_t * 1.49) * 0.1
        )
        
        # Pitch (head up/down / breathing): maps breathing rhythm (max 0.9 degrees)
        # Slower pace typical of breathing (approx. 14 breaths per minute = ~0.23Hz)
        target_pitch = (
            math.sin(curr_t * 0.51) * 0.5 + 
            math.sin(curr_t * 1.13) * 0.2 + 
            math.cos(curr_t * 0.23) * 0.1
        )
        
        # Roll (tilt side to side): elegant head tilt (max 0.8 degrees)
        target_roll = (
            math.sin(curr_t * 0.39) * 0.4 + 
            math.cos(curr_t * 0.83) * 0.3
        )
        
        # dx, dy (micro-position camera translations in pixels / 100 for normalization)
        target_tx = (math.sin(curr_t * 0.61) * 0.2) / 100.0
        target_ty = (math.cos(curr_t * 0.47) * 0.3) / 100.0
        
        # Amplify movement slightly when talking to feel more expressive
        if status == "talking":
            target_yaw *= 1.3
            target_pitch *= 1.2
            target_tx *= 1.2
            
        # Exponential Moving Average (EMA) to ensure absolute spatial fluidness
        alpha = 0.12 # Soft easing
        self.current_yaw = (alpha * target_yaw) + ((1.0 - alpha) * self.current_yaw)
        self.current_pitch = (alpha * target_pitch) + ((1.0 - alpha) * self.current_pitch)
        self.current_roll = (alpha * target_roll) + ((1.0 - alpha) * self.current_roll)
        self.current_trans_x = (alpha * target_tx) + ((1.0 - alpha) * self.current_trans_x)
        self.current_trans_y = (alpha * target_ty) + ((1.0 - alpha) * self.current_trans_y)
        
        # Pose array: [yaw, pitch, roll, trans_x, trans_y, scale_z (depth)]
        driving_pose = np.array([
            self.current_yaw,
            self.current_pitch,
            self.current_roll,
            self.current_trans_x,
            self.current_trans_y,
            1.0  # Scale constant
        ], dtype=np.float32)
        
        return driving_pose, self.eyelid_openness
