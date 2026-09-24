/*
 * LRMaster photolib — the photographs that ship with the app.
 *
 * Written by scripts/fetch-photos.js; do not edit by hand. Every entry names
 * the file in app/photos/, the subject it shows (a key of photo.js), who took
 * it, where it comes from and under which licence — the credit is printed
 * next to the picture and listed in the teacher version. Only openly licensed
 * pictures belong here (Pexels licence, Unsplash licence, CC0, public domain,
 * CC BY with the credit kept). `persona: true` marks a portrait that may stand
 * in for an invented person (a stock model); a picture of a real, named person
 * never does.
 *
 * An empty list is a valid library: every picture is then drawn by photo.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.photolib = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    version: 1,
    fetched: '',
    photos: [],
  };
});
