import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { ProblemScene } from "./scenes/ProblemScene";
import { SolutionIntroScene } from "./scenes/SolutionIntroScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { LocalFirstScene } from "./scenes/LocalFirstScene";
import { CTAScene } from "./scenes/CTAScene";

// Scene configuration with frame timings (slower transitions)
const SCENES = {
  problem: { start: 0, duration: 180 },        // 0-6s: The pain of scrolling X
  solution: { start: 180, duration: 150 },     // 6-11s: Intro grok-engage
  features: { start: 330, duration: 360 },     // 11-23s: Features (3 phases × 120 frames)
  localFirst: { start: 690, duration: 210 },   // 23-30s: Local-first + LLM flexibility
  cta: { start: 900, duration: 150 },          // 30-35s: CTA
};

// Transition component for smooth scene changes
const Transition: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();

  // Slower fade in at start (30 frames = 1 second)
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slower fade out at end (30 frames = 1 second)
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 30, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill className="bg-white">
      {/* Scene 1: Problem - The pain of scrolling X */}
      <Sequence from={SCENES.problem.start} durationInFrames={SCENES.problem.duration}>
        <Transition durationInFrames={SCENES.problem.duration}>
          <ProblemScene />
        </Transition>
      </Sequence>

      {/* Scene 2: Solution Introduction */}
      <Sequence from={SCENES.solution.start} durationInFrames={SCENES.solution.duration}>
        <Transition durationInFrames={SCENES.solution.duration}>
          <SolutionIntroScene />
        </Transition>
      </Sequence>

      {/* Scene 3: Features Showcase */}
      <Sequence from={SCENES.features.start} durationInFrames={SCENES.features.duration}>
        <Transition durationInFrames={SCENES.features.duration}>
          <FeaturesScene />
        </Transition>
      </Sequence>

      {/* Scene 4: Local-First Benefits */}
      <Sequence from={SCENES.localFirst.start} durationInFrames={SCENES.localFirst.duration}>
        <Transition durationInFrames={SCENES.localFirst.duration}>
          <LocalFirstScene />
        </Transition>
      </Sequence>

      {/* Scene 5: Call to Action */}
      <Sequence from={SCENES.cta.start} durationInFrames={SCENES.cta.duration}>
        <Transition durationInFrames={SCENES.cta.duration}>
          <CTAScene />
        </Transition>
      </Sequence>
    </AbsoluteFill>
  );
};

// Total duration: 1050 frames @ 30fps = 35 seconds
export const DEMO_VIDEO_DURATION = 1050;
