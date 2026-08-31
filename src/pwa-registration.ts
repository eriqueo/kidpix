const UPDATE_READY_BUTTON_ID = "pwa-update-ready-btn";
const REGISTRATION_ERROR_CODE = "PWA_REGISTRATION_FAILED";

type ServiceWorkerPort = Pick<
  ServiceWorkerContainer,
  "controller" | "addEventListener" | "register"
>;

interface UpdateFlowPorts {
  serviceWorker: ServiceWorkerPort;
  button: HTMLButtonElement;
  workerUrl: string;
  scope: string;
  flushDrawing: () => void;
  reload: () => void;
}

/**
 * Wire the shared worker/page update protocol and return the registration
 * effect so the composition root can schedule it after the window load event.
 */
export function wirePwaUpdateFlow({
  serviceWorker,
  button,
  workerUrl,
  scope,
  flushDrawing,
  reload,
}: UpdateFlowPorts): () => Promise<ServiceWorkerRegistration> {
  const controlledAtStart = serviceWorker.controller !== null;

  serviceWorker.addEventListener(
    "controllerchange",
    () => {
      // clientsClaim() also produces controllerchange on a first install. That
      // is not an update and must not ask the child to reload.
      if (controlledAtStart) button.hidden = false;
    },
    { once: true },
  );

  button.addEventListener("click", () => {
    button.disabled = true;
    flushDrawing();
    reload();
  });

  return () =>
    serviceWorker.register(workerUrl, {
      scope,
      // Always revalidate the worker and its imports. Revisioned application
      // assets remain governed by Workbox's precache.
      updateViaCache: "none",
    });
}

function initializePwaRegistration(): void {
  if (!("serviceWorker" in navigator)) return;

  const button = document.getElementById(UPDATE_READY_BUTTON_ID);
  if (!(button instanceof HTMLButtonElement)) return;

  const base = import.meta.env.BASE_URL;
  const register = wirePwaUpdateFlow({
    serviceWorker: navigator.serviceWorker,
    button,
    workerUrl: `${base}sw.js`,
    scope: base,
    flushDrawing: () => window.KiddoPaint.Display.flushPersist(),
    reload: () => window.location.reload(),
  });

  const registerAtBoundary = () => {
    void register().catch((error: unknown) => {
      console.error(REGISTRATION_ERROR_CODE, error);
    });
  };

  if (document.readyState === "complete") registerAtBoundary();
  else window.addEventListener("load", registerAtBoundary, { once: true });
}

initializePwaRegistration();
