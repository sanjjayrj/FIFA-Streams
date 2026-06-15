import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Maximize,
  Minimize,
  Play,
  RotateCw,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  Tv,
} from "lucide-react";
import { useFullscreen, usePersistentState } from "../hooks";
import { classifySource, hostOf } from "../utils";

interface PlayerProps {
  url: string | null;
  title: string;
  live: boolean;
  onReload: () => void;
  reloadKey: number;
}

/** Native HLS playback via hls.js — no ads, full <video> controls. */
function HlsVideo({
  src,
  onLoaded,
  onError,
}: {
  src: string;
  onLoaded: () => void;
  onError: (msg: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS play HLS natively.
      video.src = src;
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onLoaded();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal)
          onError(
            `${data.type} — the stream may be offline, geo-locked, or require a proxy.`
          );
      });
    } else {
      onError("This browser can't play HLS.");
    }

    return () => hls?.destroy();
  }, [src, onLoaded, onError]);

  return (
    <video
      ref={ref}
      className="stage-frame"
      controls
      autoPlay
      playsInline
      crossOrigin="anonymous"
    />
  );
}

export function Player({ url, title, live, onReload, reloadKey }: PlayerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggle } = useFullscreen(stageRef.current);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Pop-up shield: a transparent layer over the embed that swallows stray taps
  // so the provider's script can't fire a pop-under/redirect ad tab.
  const [shield, setShield] = usePersistentState<boolean>("fifa.shield", true);

  // When "armed", the shield lets clicks pass through to the embed for a short
  // window so the user can start/control the player, then it auto-re-locks.
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ARM_MS = 4000;
  const arm = useCallback(() => {
    setArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(false), ARM_MS);
  }, []);
  useEffect(() => () => {
    if (armTimer.current) clearTimeout(armTimer.current);
  }, []);

  const [slowHint, setSlowHint] = useState(false);
  const kind = url ? classifySource(url) : null;

  // Reset transient state whenever the source or reload key changes.
  useEffect(() => {
    setLoading(true);
    setErr(null);
    setArmed(false);
    setSlowHint(false);
    if (!url) return;
    // If the embed page hasn't loaded in time, it may be region/ISP-blocked.
    const t = setTimeout(() => setSlowHint(true), 16000);
    return () => clearTimeout(t);
  }, [url, reloadKey]);

  const handleLoaded = useCallback(() => setLoading(false), []);
  const handleError = useCallback((m: string) => {
    setErr(m);
    setLoading(false);
  }, []);

  return (
    <div className="player">
      <div className="player-bar">
        <div className="player-title">
          {live && <span className="live-dot" aria-hidden />}
          {live && <span className="live-label">LIVE</span>}
          <span className="title-text" title={title}>
            {title}
          </span>
          {url && (
            <span className="host-chip">
              {kind === "hls" ? "HLS · ad-free" : hostOf(url)}
            </span>
          )}
        </div>
        <div className="player-actions">
          {kind === "iframe" && url && (
            <button
              className={`icon-btn ${shield ? "active" : ""}`}
              onClick={() => setShield((v) => !v)}
              title="Pop-up shield: blocks the taps that make the embed open ad tabs. Turn off if you need to click the player's own controls."
            >
              {shield ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
              Shield {shield ? "on" : "off"}
            </button>
          )}
          <button
            className="icon-btn"
            onClick={() => {
              setLoading(true);
              onReload();
            }}
            title="Reload stream"
          >
            <RotateCw size={15} /> Reload
          </button>
          <button
            className="icon-btn primary"
            onClick={toggle}
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className={`stage ${isFullscreen ? "is-fullscreen" : ""}`} ref={stageRef}>
        {url ? (
          <>
            {loading && !err && (
              <div className="stage-loading">
                <div className="spinner" />
                {slowHint ? (
                  <div className="stage-slow">
                    <span>Still loading…</span>
                    <span className="muted">
                      This stream may be blocked or slow on your network/region.
                      Try <b>Reload</b>, pick another stream from the match’s
                      “Watch” list, or paste a different source below. (Some
                      providers are geo/ISP-blocked — a VPN on your end helps.)
                    </span>
                  </div>
                ) : (
                  <span>Loading stream…</span>
                )}
              </div>
            )}
            {err && (
              <div className="stage-empty">
                <TriangleAlert className="stage-empty-ico" size={40} />
                <p>Couldn’t play this stream.</p>
                <p className="muted">{err}</p>
              </div>
            )}
            {kind === "hls" ? (
              <HlsVideo
                key={`${url}#${reloadKey}`}
                src={url}
                onLoaded={handleLoaded}
                onError={handleError}
              />
            ) : (
              <>
                <iframe
                  key={`${url}#${reloadKey}`}
                  title={title}
                  src={url}
                  className="stage-frame"
                  allow="encrypted-media; picture-in-picture; autoplay; fullscreen"
                  allowFullScreen
                  referrerPolicy="origin"
                  onLoad={() => setLoading(false)}
                />
                {shield && (
                  // Sits on top of the iframe. While locked it captures the
                  // pointer so stray taps can't reach the embed's ad script.
                  // "Enable interaction" makes it click-through for a few
                  // seconds so the user can start/control the player.
                  <div className={`click-shield ${armed ? "armed" : ""}`}>
                    {armed ? (
                      <div className="shield-pill armed">
                        <Play size={13} /> Interact now — re-locks shortly
                      </div>
                    ) : (
                      <button
                        className="shield-pill"
                        onClick={arm}
                        title="Let your clicks reach the player for a few seconds (an ad may open). Stray taps stay blocked."
                      >
                        <ShieldCheck size={13} /> Shield on · tap to interact
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="stage-empty">
            <Tv className="stage-empty-ico" size={40} />
            <p>No stream loaded.</p>
            <p className="muted">
              Paste an embed code, pick a stream from a fixture, or load a direct
              .m3u8 link for ad-free playback.
            </p>
          </div>
        )}
      </div>

      {kind === "iframe" && url && (
        <div className="player-note">
          ⓘ Third-party embed. A web page <b>cannot</b> close a tab the embed
          opens, and the click that controls the player is the same gesture the
          embed uses to open an ad — so they can’t be fully separated. The{" "}
          <b>pop-up shield</b> blocks the stray taps (no random ad tabs while you
          watch); hit <b>Enable interaction</b> when you actually need to
          start/control the player. The stream usually autoplays, so often you
          won’t need to click at all.
        </div>
      )}
    </div>
  );
}
