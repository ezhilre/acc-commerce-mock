/**
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// @ts-check
/// <reference lib="webworker" />

/** @import {  PushNotificationData  } from '../types.js' */
/** @import { ServiceWorkerLogger } from '../types.js' */

/**
 * @async
 * @function
 *
 * @param {Object} options
 * @param {ServiceWorkerGlobalScope} options.sw
 * @param {PushEvent} options.event
 * @param {ServiceWorkerLogger} options.logger
 * @returns {Promise<void>}
 */
var serviceWorkerPushListener = async ({ sw, event, logger }) => {
  if (!event.data) {
    return;
  }

  /** @type {PushNotificationData} */
  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (error) {
    // Fallback: treat push data as plain text and show a basic notification
    const text = event.data.text();
    if (text) {
      logger.info("Push data is not JSON, falling back to plain text notification.");
      return sw.registration.showNotification(text, {});
    }
    logger.error("Error decoding notification JSON data:", error);
    return;
  }

  const webData = notificationData.web;
  if (!webData?.title) {
    return;
  }

  const notificationOptions = {
    body: webData.body,
    icon: webData.media,
    image: webData.media,
    data: webData,
    actions: [],
  };

  Object.keys(notificationOptions).forEach((k) => {
    if (notificationOptions[k] == null) {
      delete notificationOptions[k];
    }
  });

  if (webData.actions && webData.actions.buttons) {
    notificationOptions.actions = webData.actions.buttons.map(
      (button, index) => ({
        action: `action_${index}`,
        title: button.label,
      }),
    );
  }

  return sw.registration.showNotification(webData.title, notificationOptions);
};

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

// @ts-check
/// <reference lib="webworker" />

/** @import { ServiceWorkerLogger } from '../types.js' */

/**
 * @param {string} type
 * @returns {boolean}
 */
const canHandleUrl = (type) => ["DEEPLINK", "WEBURL"].includes(type);

/**
 * @param {Object} dependencies
 * @param {(options: { xdm: Object, actionLabel?: string, applicationLaunches?: number }) => Promise<boolean>} dependencies.makeSendServiceWorkerTrackingData
 * @param {ServiceWorkerGlobalScope} dependencies.sw
 * @param {ServiceWorkerLogger} dependencies.logger
 */
var createServiceWorkerNotificationClickListener = ({ makeSendServiceWorkerTrackingData, sw, logger }) => {
  /**
   * @function
   *
   * @param {Object} options
   * @param {NotificationEvent} options.event
   */
  return ({ event }) => {
    event.notification.close();

    const data = event.notification.data;
    let targetUrl = null;
    let actionLabel = null;

    if (event.action) {
      const actionIndex = parseInt(event.action.replace("action_", ""), 10);
      if (data?.actions?.buttons[actionIndex]) {
        const button = data.actions.buttons[actionIndex];
        actionLabel = button.label;
        if (canHandleUrl(button.type) && button.uri) {
          targetUrl = button.uri;
        }
      }
    } else if (
      canHandleUrl(data?.interaction?.type) &&
      data?.interaction?.uri
    ) {
      targetUrl = data.interaction.uri;
    }

    makeSendServiceWorkerTrackingData({
      // eslint-disable-next-line no-underscore-dangle
      xdm: data._xdm.mixins,
      actionLabel,
      applicationLaunches: 1,
    }).catch((error) => {
      logger.error("Failed to send tracking call:", error);
    });

    if (targetUrl) {
      event.waitUntil(
        sw.clients.matchAll({ type: "window" }).then((clientList) => {
          for (const client of clientList) {
            if (client.url === targetUrl && "focus" in client) {
              return client.focus();
            }
          }
          if (sw.clients.openWindow) {
            return sw.clients.openWindow(targetUrl);
          }
        }),
      );
    }
  };
};

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * @param {string} dbName
 * @param {number} dbVersion
 * @param {Function} [upgradeCallback] - Optional callback function to handle database upgrades.
 *   Called with the database instance when the database is being upgraded.
 * @returns {Promise<IDBDatabase>}
 */
const openIndexedDb = (dbName, dbVersion, upgradeCallback) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
      if (upgradeCallback) {
        upgradeCallback(db);
      }
    };
  });
};

/**
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {string|number|Date|ArrayBuffer|Array} key
 *
 * @returns {Promise<any>}
 */
const getFromIndexedDbStore = (db, storeName, key) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const DB_NAME = "alloyPushNotifications";
const DB_VERSION = 1;
const STORE_NAME = "config";
const INDEX_KEY = "alloyConfig";

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/


/**
 * @param {ServiceWorkerLogger} logger
 * @returns {Promise<Object|undefined>}
 * @throws {Error}
 */
var readFromIndexedDb = async (logger) => {
  try {
    const db = await openIndexedDb(
      DB_NAME,
      DB_VERSION,
      (/** @type {IDBDatabase} */ db) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    );

    const existingConfigData = await getFromIndexedDbStore(
      db,
      STORE_NAME,
      INDEX_KEY,
    );

    db.close();

    return existingConfigData;
  } catch (error) {
    logger.error("Failed to read data from IndexedDB", { error });
  }
};

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/** @import { ServiceWorkerLogger } from '../types.js' */
/** @import { TrackingDataPayload   } from '../types.js' */

/**
 * @param {Object} dependencies
 * @param {(logger: ServiceWorkerLogger) => Promise<Object>} dependencies.readFromIndexedDb
 * @param {() => string} dependencies.uuidv4
 * @param {ServiceWorkerLogger} dependencies.logger
 * @param {(url: string, options: object) => Promise<Response>} dependencies.fetch
 * @returns {(options: { xdm: Object, actionLabel?: string, applicationLaunches?: number }) => Promise<boolean>}
 */
const createMakeSendServiceWorkerTrackingData = ({
  readFromIndexedDb,
  uuidv4,
  logger,
  fetch,
}) => {
  /**
   * @async
   * @function
   * @param {Object} options
   * @param {Object} options.xdm
   * @param {string} [options.actionLabel]
   * @param {number} [options.applicationLaunches=0]
   *
   * @returns {Promise<boolean>}
   * @throws {Error}
   */
  return async ({ xdm, actionLabel, applicationLaunches = 0 }) => {
    const configData = await readFromIndexedDb(logger);
    const { browser, ecid, edgeDomain, edgeBasePath, datastreamId, datasetId } =
      configData || {};
    let customActionData = {};

    if (actionLabel) {
      customActionData = {
        customAction: { actionID: actionLabel },
      };
    }

    const requiredFields = [
      { name: "browser", errorField: "Browser" },
      { name: "ecid", errorField: "ECID" },
      {
        name: "edgeDomain",
        errorField: "Edge domain",
      },
      {
        name: "edgeBasePath",
        errorField: "Edge base path",
      },
      {
        name: "datastreamId",
        errorField: "Datastream ID",
      },
      {
        name: "datasetId",
        errorField: "Dataset ID",
      },
    ];

    try {
      for (const field of requiredFields) {
        if (!configData[field.name]) {
          throw new Error(
            `Cannot send tracking call. ${field.errorField} is missing.`,
          );
        }
      }

      const url = `https://${edgeDomain}/${edgeBasePath}/v1/interact?configId=${datastreamId}&requestId=${uuidv4()}`;

      /** @type {TrackingDataPayload} */
      const payload = {
        events: [
          {
            xdm: {
              identityMap: {
                ECID: [{ id: ecid }],
              },
              timestamp: new Date().toISOString(),
              pushNotificationTracking: {
                ...customActionData,
                pushProviderMessageID: uuidv4(),
                pushProvider: browser.toLowerCase(),
              },
              application: {
                launches: {
                  value: applicationLaunches,
                },
              },
              eventType: actionLabel
                ? "pushTracking.customAction"
                : "pushTracking.applicationOpened",
              _experience: {
                ...xdm._experience,
                customerJourneyManagement: {
                  ...xdm._experience.customerJourneyManagement,
                  pushChannelContext: {
                    platform: "web",
                  },
                  messageProfile: {
                    channel: {
                      _id: "https://ns.adobe.com/xdm/channels/push",
                    },
                  },
                },
              },
            },
            meta: {
              collect: {
                datasetId,
              },
            },
          },
        ],
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "text/plain; charset=UTF-8",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logger.error(
          "Tracking call failed: ",
          response.status,
          response.statusText,
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Error sending tracking call:", error);
      return false;
    }
  };
};

const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] +
        byteToHex[arr[offset + 1]] +
        byteToHex[arr[offset + 2]] +
        byteToHex[arr[offset + 3]] +
        '-' +
        byteToHex[arr[offset + 4]] +
        byteToHex[arr[offset + 5]] +
        '-' +
        byteToHex[arr[offset + 6]] +
        byteToHex[arr[offset + 7]] +
        '-' +
        byteToHex[arr[offset + 8]] +
        byteToHex[arr[offset + 9]] +
        '-' +
        byteToHex[arr[offset + 10]] +
        byteToHex[arr[offset + 11]] +
        byteToHex[arr[offset + 12]] +
        byteToHex[arr[offset + 13]] +
        byteToHex[arr[offset + 14]] +
        byteToHex[arr[offset + 15]]).toLowerCase();
}

const rnds8 = new Uint8Array(16);
function rng() {
    return crypto.getRandomValues(rnds8);
}

function v4(options, buf, offset) {
    if (!buf && !options && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
    options = options || {};
    const rnds = options.random ?? options.rng?.() ?? rng();
    if (rnds.length < 16) {
        throw new Error('Random bytes length must be >= 16');
    }
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;
    if (buf) {
        offset = offset || 0;
        if (offset < 0 || offset + 16 > buf.length) {
            throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
        }
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = rnds[i];
        }
        return buf;
    }
    return unsafeStringify(rnds);
}

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * @type {Object} PlatformCapabilities
 * @property {Logger} logger
 * @property {(url: string, options: object) => Promise<Response>} fetch
 *
 * TODO: Remove dependency on sw (service worker)
 */
const createEventListeners = ({ platform, sw }) => {
  const makeSendServiceWorkerTrackingData =
    createMakeSendServiceWorkerTrackingData({
      readFromIndexedDb,
      uuidv4: v4,
      logger: platform.logger,
      fetch: platform.fetch,
    });

  const serviceWorkerNotificationClickListener =
    createServiceWorkerNotificationClickListener({
      makeSendServiceWorkerTrackingData,
      sw,
      logger: platform.logger,
    });

  return {
    pushNotifications: {
      /**
       *
       * @param {PushEvent} event
       * @returns Promise<void>
       */
      onPush(event) {
        return serviceWorkerPushListener({
          event,
          sw,
          logger: platform.logger,
        });
      },
      /**
       * @param {NotificationEvent} event
       */
      onNotificationClick(event) {
        serviceWorkerNotificationClickListener({ event });
      },
      /**
       *
       * @param {NotificationEvent} event
       */
      async onNotificationClose(event) {
        const data = event.notification.data;

        try {
          await makeSendServiceWorkerTrackingData({
            /* eslint-disable-next-line no-underscore-dangle */
            xdm: data._xdm.mixins,
            actionLabel: "Dismiss",
          });
        } catch (error) {
          platform.logger.error("Failed to send tracking call:", error);
        }
      },
    },
  };
};

/*
Copyright 2025 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/


/* eslint-disable no-console */

// @ts-check
/// <reference lib="webworker" />

/** @import { ServiceWorkerLogger } from './components/PushNotifications/types.js' */

/** @type {ServiceWorkerGlobalScope} */
// @ts-ignore
const sw = self;

/**
 * @type {ServiceWorkerLogger}
 */
const logger = {
  namespace: "[alloy][pushNotificationWorker]",
  info: (...args) => console.log(logger.namespace, ...args),
  error: (...args) => console.error(logger.namespace, ...args),
};

const eventListeners = createEventListeners({
  sw,
  platform: {
    logger,
    fetch,
  },
});

/**
 * @listens install
 */
sw.addEventListener("install", () => {
  sw.skipWaiting();
});

/**
 * @listens activate
 * @param {ExtendableEvent} event
 */
sw.addEventListener("activate", (event) => {
  event.waitUntil(sw.clients.claim());
});

/**
 * @listens push
 * @param {PushEvent} event
 * @returns {Promise<void>}
 */
sw.addEventListener("push", (event) =>
  eventListeners.pushNotifications.onPush(event),
);

/**
 * @listens notificationclick
 * @param {NotificationEvent} event
 */
sw.addEventListener("notificationclick", (event) =>
  eventListeners.pushNotifications.onNotificationClick(event),
);

/**
 * @listens notificationclose
 * @param {NotificationEvent} event
 */
sw.addEventListener("notificationclose", (event) => {
  eventListeners.pushNotifications.onNotificationClose(event);
});
