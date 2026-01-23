import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { FadeIn } from "../components/FadeIn";

const FeatureCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  delay: number;
}> = ({ title, description, icon, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="p-8 bg-white border-4 border-black"
      style={{
        transform: `scale(${Math.max(0, scale)})`,
        opacity: Math.max(0, opacity),
      }}
    >
      <div className="text-7xl mb-4">{icon}</div>
      <h3 className="text-3xl font-black text-black mb-3">{title}</h3>
      <p className="text-neutral-600 text-2xl">{description}</p>
    </div>
  );
};

const ReplyStyleCard: React.FC<{
  style: string;
  example: string;
  delay: number;
}> = ({ style, example, delay }) => {
  const frame = useCurrentFrame();

  const slideX = interpolate(frame - delay, [0, 25], [50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(frame - delay, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      className="p-6 bg-neutral-100 border-2 border-black"
      style={{
        transform: `translateX(${slideX}px)`,
        opacity,
      }}
    >
      <div className="text-xl font-bold text-black mb-2">{style}</div>
      <p className="text-neutral-700 text-xl italic">"{example}"</p>
    </div>
  );
};

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: Thread Discovery (0-120)
  // Phase 2: Reply Generation (120-240)
  // Phase 3: Learning System (240-360)

  const phase = frame < 120 ? 1 : frame < 240 ? 2 : 3;

  return (
    <div className="w-full h-full bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Phase 1: Thread Discovery */}
      {phase === 1 && (
        <div className="relative z-10 w-full max-w-7xl px-12">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-7xl font-black text-center text-black mb-16">
              Find Threads Automatically
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-10">
            <FeatureCard
              icon="🔍"
              title="Keyword Search"
              description="Real-time monitoring"
              delay={20}
            />
            <FeatureCard
              icon="🎯"
              title="Smart Filter"
              description="15+ replies only"
              delay={35}
            />
            <FeatureCard
              icon="📊"
              title="Relevance Score"
              description="0-100 ranking"
              delay={50}
            />
          </div>

          {/* Mock thread preview */}
          <FadeIn delay={70} duration={25}>
            <div className="mt-14 p-8 bg-white border-4 border-black max-w-2xl mx-auto">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-black" />
                <div>
                  <div className="text-black font-bold text-3xl">@indiehacker</div>
                </div>
                <div className="ml-auto px-5 py-2 bg-black text-white text-2xl font-bold">
                  87
                </div>
              </div>
              <p className="text-black text-2xl">
                "What tools do you use to grow your SaaS?"
              </p>
              <div className="mt-4 text-neutral-500 text-xl">
                💬 47 · ❤️ 234
              </div>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase 2: Reply Generation */}
      {phase === 2 && (
        <div className="relative z-10 w-full max-w-7xl px-12">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-7xl font-black text-center text-black mb-16">
              AI-Generated Replies
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-10">
            <div className="space-y-6">
              <FadeIn delay={15} duration={25}>
                <div className="text-center mb-6">
                  <span className="text-6xl">💡</span>
                  <h3 className="text-3xl font-black text-black mt-3">Value-Add</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="Great question! Focus on one channel first."
                delay={30}
              />
            </div>

            <div className="space-y-6">
              <FadeIn delay={25} duration={25}>
                <div className="text-center mb-6">
                  <span className="text-6xl">✨</span>
                  <h3 className="text-3xl font-black text-black mt-3">Light Promo</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="This is why I built [Product]..."
                delay={45}
              />
            </div>

            <div className="space-y-6">
              <FadeIn delay={35} duration={25}>
                <div className="text-center mb-6">
                  <span className="text-6xl">🎯</span>
                  <h3 className="text-3xl font-black text-black mt-3">Direct</h3>
                </div>
              </FadeIn>
              <ReplyStyleCard
                style=""
                example="Check out [Product] — saves hours."
                delay={60}
              />
            </div>
          </div>

          <FadeIn delay={80} duration={25}>
            <div className="mt-14 flex justify-center gap-6">
              <button className="px-8 py-4 bg-white border-4 border-black text-black text-2xl font-bold">
                🔄 Funnier
              </button>
              <button className="px-8 py-4 bg-white border-4 border-black text-black text-2xl font-bold">
                ✂️ Shorter
              </button>
              <button className="px-8 py-4 bg-white border-4 border-black text-black text-2xl font-bold">
                🔧 Technical
              </button>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase 3: Learning System */}
      {phase === 3 && (
        <div className="relative z-10 w-full max-w-7xl px-12">
          <FadeIn delay={0} duration={25}>
            <h2 className="text-7xl font-black text-center text-black mb-16">
              Gets Smarter Over Time
            </h2>
          </FadeIn>

          <div className="grid grid-cols-3 gap-10">
            <FeatureCard
              icon="🧠"
              title="Learns Preferences"
              description="Topics & authors"
              delay={20}
            />
            <FeatureCard
              icon="🎨"
              title="Matches Voice"
              description="Tone & style"
              delay={35}
            />
            <FeatureCard
              icon="📈"
              title="Tracks Results"
              description="What works"
              delay={50}
            />
          </div>

          <FadeIn delay={70} duration={25}>
            <div className="mt-14 p-10 bg-neutral-100 border-4 border-black text-center">
              <h4 className="text-4xl font-black text-black">
                Self-Improving Keywords
              </h4>
              <p className="text-neutral-600 mt-4 text-2xl">
                3-4x more relevant threads after a few weeks
              </p>
            </div>
          </FadeIn>
        </div>
      )}

      {/* Phase indicator */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-5">
        {[1, 2, 3].map((p) => (
          <div
            key={p}
            className={`w-5 h-5 transition-all ${
              phase === p ? "bg-black scale-125" : "bg-neutral-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
