import { useEffect, useRef } from 'react';
// AUTH_BYPASS — import { useIsAuthenticated } from '@azure/msal-react';
// AUTH_BYPASS — import { logout } from '../authConfig';

// 30 minutes of no activity → auto logout.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// Warn the user this many ms before forced logout.
const WARN_BEFORE_MS = 60 * 1000;
// Throttle activity bookkeeping (timer reset + localStorage write).
const ACTIVITY_THROTTLE_MS = 1000;
// Hard cap a single in-flight request can keep the session alive.
const MAX_REQUEST_HOLD_MS = 10 * 60 * 1000;

const ACTIVITY_EVENTS = [
    'mousemove',
    'mousedown',
    'keydown',
    'click',
    'scroll',
    'touchstart',
    'wheel'
];

const ACTIVITY_KEY = '__idle_activity__';
const LOGOUT_KEY = '__idle_logout__';

// Module-level in-flight counter shared across remounts.
let inFlightRequests = 0;
let resetTimerCallback = null;
let networkPatched = false;

function patchNetworkOnce() {
    if (networkPatched || typeof window === 'undefined') return;
    networkPatched = true;

    const trackRequest = () => {
        inFlightRequests++;
        if (resetTimerCallback) resetTimerCallback();
        let released = false;
        const release = () => {
            if (released) return;
            released = true;
            inFlightRequests = Math.max(0, inFlightRequests - 1);
            if (resetTimerCallback) resetTimerCallback();
        };
        // Hard cap so a hung request can never keep the session alive
        // beyond MAX_REQUEST_HOLD_MS.
        setTimeout(release, MAX_REQUEST_HOLD_MS);
        return release;
    };

    if (typeof window.fetch === 'function') {
        const origFetch = window.fetch.bind(window);
        window.fetch = (...args) => {
            const release = trackRequest();
            return origFetch(...args).then(
                (res) => { release(); return res; },
                (err) => { release(); throw err; }
            );
        };
    }

    if (typeof window.XMLHttpRequest === 'function') {
        const OrigSend = window.XMLHttpRequest.prototype.send;
        window.XMLHttpRequest.prototype.send = function patchedSend(...args) {
            const release = trackRequest();
            this.addEventListener('loadend', release);
            return OrigSend.apply(this, args);
        };
    }
}

function IdleLogout() {
    const isAuthenticated = true; // AUTH_BYPASS
    const idleTimerRef = useRef(null);
    const warnTimerRef = useRef(null);
    const lastActivityRef = useRef(0);
    const warnedRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        patchNetworkOnce();

        const clearTimers = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
            idleTimerRef.current = null;
            warnTimerRef.current = null;
        };

        const triggerLogout = async () => {
            try {
                // Notify other tabs to log out as well.
                try { localStorage.setItem(LOGOUT_KEY, String(Date.now())); } catch (_) {}
                console.warn('[IdleLogout] Session expired due to inactivity. Logging out.');
                // AUTH_BYPASS — await logout();
                console.log('[IdleLogout] AUTH_BYPASS: logout skipped'); // AUTH_BYPASS
            } catch (err) {
                console.error('[IdleLogout] logout failed', err);
            }
        };

        const showWarning = () => {
            if (warnedRef.current) return;
            warnedRef.current = true;
            // Console-only warning; keep non-blocking. Wire to a toast/modal
            // if you want a visible UI prompt.
            console.warn('[IdleLogout] You will be logged out in 1 minute due to inactivity.');
        };

        const scheduleTimers = () => {
            clearTimers();
            // If a request is in flight, defer scheduling until it completes
            // (request completion calls scheduleTimers again).
            if (inFlightRequests > 0) {
                idleTimerRef.current = setTimeout(scheduleTimers, 5000);
                return;
            }
            warnedRef.current = false;
            warnTimerRef.current = setTimeout(showWarning, IDLE_TIMEOUT_MS - WARN_BEFORE_MS);
            idleTimerRef.current = setTimeout(triggerLogout, IDLE_TIMEOUT_MS);
        };

        // Throttled activity handler — coalesces mousemove storms.
        const onActivity = () => {
            const now = Date.now();
            if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
            lastActivityRef.current = now;
            try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch (_) {}
            scheduleTimers();
        };

        // Cross-tab sync: activity in another tab → reset; logout → also logout here.
        const onStorage = (e) => {
            if (e.key === ACTIVITY_KEY) {
                lastActivityRef.current = Date.now();
                scheduleTimers();
            } else if (e.key === LOGOUT_KEY) {
                triggerLogout();
            }
        };

        resetTimerCallback = scheduleTimers;

        ACTIVITY_EVENTS.forEach(evt =>
            window.addEventListener(evt, onActivity, { passive: true })
        );
        window.addEventListener('storage', onStorage);

        // Start the initial timer.
        scheduleTimers();

        return () => {
            ACTIVITY_EVENTS.forEach(evt =>
                window.removeEventListener(evt, onActivity)
            );
            window.removeEventListener('storage', onStorage);
            clearTimers();
            resetTimerCallback = null;
        };
    }, [isAuthenticated]);

    return null;
}

export default IdleLogout;
