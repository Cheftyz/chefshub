import type { Platform } from "../lib/types";
import { IcKick, IcTwitch } from "./Icons";

export const PLATFORMS: Record<
  Platform,
  { label: string; color: string; Icon: typeof IcTwitch }
> = {
  twitch: { label: "Twitch", color: "#a970ff", Icon: IcTwitch },
  kick: { label: "Kick", color: "#53fc18", Icon: IcKick },
};

export function PlatformBadge({ platform, size = 13 }: { platform: Platform; size?: number }) {
  const { Icon, color } = PLATFORMS[platform];
  return <Icon width={size} height={size} style={{ color }} className="shrink-0" />;
}
