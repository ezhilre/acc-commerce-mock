/**
 * Adobe Experience Platform Web SDK — Service Worker proxy
 *
 * The AJO Web SDK registers this file as its own service worker using a
 * relative path (/alloyServiceWorker.js).  This file must exist at the root
 * of the site and simply delegates to the versioned CDN build via importScripts.
 *
 * If you upgrade the alloy version, update the URL below to match.
 */
importScripts('https://cdn1.adoberesources.net/alloy/2.33.1/alloyServiceWorker.js');
