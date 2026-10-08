# Changelog

## [1.3.8](https://github.com/Annoto/moodle-local-js/compare/v1.4.0...v1.3.8) (2026-10-08)


### Features

* activity completion ([#8](https://github.com/Annoto/moodle-local-js/issues/8)) ([e1868d6](https://github.com/Annoto/moodle-local-js/commit/e1868d6e45573dceeb34ce6035df29a2392f17b8))
* add support for mod tabs with nested divs ([9a771f9](https://github.com/Annoto/moodle-local-js/commit/9a771f95edc9205b0b35255fdae935cb52144cba))
* Annoto completion support for Annoto LTI assignments ([#10](https://github.com/Annoto/moodle-local-js/issues/10)) ([b87f679](https://github.com/Annoto/moodle-local-js/commit/b87f679c87e838b6700e496123a641153a7d285f))
* apply group/course context to Kaltura V7 via api.load() ([b4e0994](https://github.com/Annoto/moodle-local-js/commit/b4e09946528f713472cc8f69db26dac67b6acae6))
* init ([bf1fed4](https://github.com/Annoto/moodle-local-js/commit/bf1fed4a3dce52df5a32768409c787a27ec8bd25))
* Kaltura V7 (playkit) player embed support ([b430456](https://github.com/Annoto/moodle-local-js/commit/b4304564bbd3064cdfdd766d8b2e1667d2a17302))
* Kaltura V7 (playkit) player embed support ([ab51617](https://github.com/Annoto/moodle-local-js/commit/ab5161711ebd64563ffa83594e08b81d354425eb))
* SSO-authenticate Kaltura V7 players via api.auth() like V2 ([e1d19d0](https://github.com/Annoto/moodle-local-js/commit/e1d19d0fc5cd68432fb7a7502369cbc16feaf24c))
* support Zoodle (zoodle.macam.ac.il) recording embeds ([747b85e](https://github.com/Annoto/moodle-local-js/commit/747b85e0c0018a4028e969ea276d4e41fab01f1d))
* support Zoodle (zoodle.macam.ac.il) recording embeds ([8aea9c1](https://github.com/Annoto/moodle-local-js/commit/8aea9c19e514d874b8afcbb942453a9e331e031e))


### Bug Fixes

* add teardown path for tiles observer and failsafe timer ([4aa1a22](https://github.com/Annoto/moodle-local-js/commit/4aa1a22a808db765250a311ff8647ac86326160c))
* back off my_activity subscribe retries instead of a 60s cap ([d7eaa14](https://github.com/Annoto/moodle-local-js/commit/d7eaa1412d8274f593507e4605a281bfa10aa444))
* cap iframe my_activity subscribe retries ([edf8767](https://github.com/Annoto/moodle-local-js/commit/edf8767087f2a0d607fb069d58930363eccdbcd5))
* change not needed warn logs into info ([e43d81b](https://github.com/Annoto/moodle-local-js/commit/e43d81b6c9ea875ac1e4321a6ed00c27c1eacb88))
* defer app DOM creation from constructor to setup ([3d357e0](https://github.com/Annoto/moodle-local-js/commit/3d357e0ada71803076101320ba52b211dd28bbdd))
* detect V7 page via window.KalturaPlayer to close double-boot gap ([75efb91](https://github.com/Annoto/moodle-local-js/commit/75efb9148be06d4e3fb793440c582771e5235c2e))
* don't double-boot Annoto on Kaltura V7 (playkit) players ([7d4a141](https://github.com/Annoto/moodle-local-js/commit/7d4a141c19ce5fcea44b25c86816fd0735af63e4))
* find Kaltura V7 players ourselves so the fix needs no plugin update ([b61f859](https://github.com/Annoto/moodle-local-js/commit/b61f85966e06ee493d746e13df09bb3f3c244e1e))
* gate V7 exclusions on kalturaV7 plugin flag (backward compat) ([c0f4863](https://github.com/Annoto/moodle-local-js/commit/c0f486340f7044659e10bc27bafaa0b76c75fb7a))
* guard myActivity JSON.parse against malformed user_data ([ffc567a](https://github.com/Annoto/moodle-local-js/commit/ffc567a776c5c8a000fd72a4fd187764e30c9a27))
* HTML-escape dynamic values in completion status markup ([203f09d](https://github.com/Annoto/moodle-local-js/commit/203f09da01a180254b4cef25e4cdd52c0ab94939))
* Kaltura V7 SSO lost when the playkit setup hook is missed ([4d59ce3](https://github.com/Annoto/moodle-local-js/commit/4d59ce36461a83112b84bf00a807cf88b966e8f4))
* Kaltura V7 SSO lost when the playkit setup hook is missed ([8f24fd0](https://github.com/Annoto/moodle-local-js/commit/8f24fd071945b0ba221fac5d54a54f6c360f8abf))
* player detection crashed on every page since 1.4.0 ([8cdf0bd](https://github.com/Annoto/moodle-local-js/commit/8cdf0bd673b517e87bceb80b46b1c10da6fee87a))
* preserve major/minor in parseMoodleVersion for 2-part releases ([974e0e3](https://github.com/Annoto/moodle-local-js/commit/974e0e3fa17695feb989a796d84e741ccab2e958))
* prevent V7 double-boot + make overflow unclip stick on page load ([324434b](https://github.com/Annoto/moodle-local-js/commit/324434b108494ed5f2bc6bc45534b8f645f63454))
* snap theme support ([#12](https://github.com/Annoto/moodle-local-js/issues/12)) ([cb4e2d9](https://github.com/Annoto/moodle-local-js/commit/cb4e2d9a519582e1c97d552d5469a4eb94c094b2))
* stop propagation of click events from widget to prevent moodle dialog from closing ([#16](https://github.com/Annoto/moodle-local-js/issues/16)) ([89e4c5a](https://github.com/Annoto/moodle-local-js/commit/89e4c5aa8e46652406da29edbd140811d7c68ed4))
* stop the Kaltura V7 sweep on pages with no sign of playkit ([62b7ada](https://github.com/Annoto/moodle-local-js/commit/62b7ada3b579320a609e7bb016bb01f35042cc0e))
* tiles format support ([#14](https://github.com/Annoto/moodle-local-js/issues/14)) ([e963260](https://github.com/Annoto/moodle-local-js/commit/e9632600ad6aa6c9a25a12de461e70d86e2ea323))
* unclip Kaltura V7 widget from Moodle .no-overflow wrapper ([28a4e0f](https://github.com/Annoto/moodle-local-js/commit/28a4e0f765ce966f4a77944046e7a24ec129756c))
* validate postMessage source to prevent completion spoofing ([335a016](https://github.com/Annoto/moodle-local-js/commit/335a016d9cf04b0603243bf9b35234f733cc5e13))
* widget load and unload for plain format with content in summary section ([#20](https://github.com/Annoto/moodle-local-js/issues/20)) ([546caa6](https://github.com/Annoto/moodle-local-js/commit/546caa63821ec87a1e71a89ba09a55a294117098))
* widget positioning on scroll for moodle v4.0 - v.4.2 ([9def84e](https://github.com/Annoto/moodle-local-js/commit/9def84e1aa7f381eb5f6608147cc2351a35f9ac6))


### Miscellaneous Chores

* release 1.0.0 ([9ec4e3d](https://github.com/Annoto/moodle-local-js/commit/9ec4e3d8ba3b735f8c8cac97804a0b918139237b))
* release 1.0.0 ([e0e22c1](https://github.com/Annoto/moodle-local-js/commit/e0e22c184bd9a1411b5653fea6389224ecc2df21))
* release 1.3.3 ([abef528](https://github.com/Annoto/moodle-local-js/commit/abef52883b1814edecd32d17d4a8fb4d00f55349))
* release 1.3.8 instead of 1.4.0 ([b326114](https://github.com/Annoto/moodle-local-js/commit/b326114e468eb6e59d3bf58cd63e697e24a7820f))

## [1.3.7](https://github.com/Annoto/moodle-local-js/compare/v1.3.6...v1.3.7) (2026-09-22)


### Bug Fixes

* find Kaltura V7 players ourselves so the fix needs no plugin update ([b61f859](https://github.com/Annoto/moodle-local-js/commit/b61f85966e06ee493d746e13df09bb3f3c244e1e))
* Kaltura V7 SSO lost when the playkit setup hook is missed ([4d59ce3](https://github.com/Annoto/moodle-local-js/commit/4d59ce36461a83112b84bf00a807cf88b966e8f4))
* Kaltura V7 SSO lost when the playkit setup hook is missed ([8f24fd0](https://github.com/Annoto/moodle-local-js/commit/8f24fd071945b0ba221fac5d54a54f6c360f8abf))
* stop the Kaltura V7 sweep on pages with no sign of playkit ([62b7ada](https://github.com/Annoto/moodle-local-js/commit/62b7ada3b579320a609e7bb016bb01f35042cc0e))

## [1.3.5](https://github.com/Annoto/moodle-local-js/compare/v1.3.4...v1.3.5) (2025-08-06)


### Bug Fixes

* change not needed warn logs into info ([e43d81b](https://github.com/Annoto/moodle-local-js/commit/e43d81b6c9ea875ac1e4321a6ed00c27c1eacb88))

## [1.3.4](https://github.com/Annoto/moodle-local-js/compare/v1.3.3...v1.3.4) (2024-12-25)


### Bug Fixes

* widget load and unload for plain format with content in summary section ([#20](https://github.com/Annoto/moodle-local-js/issues/20)) ([546caa6](https://github.com/Annoto/moodle-local-js/commit/546caa63821ec87a1e71a89ba09a55a294117098))

## [1.3.3](https://github.com/Annoto/moodle-local-js/compare/1.3.3...v1.3.3) (2024-10-06)


### Miscellaneous Chores

* release 1.3.3 ([abef528](https://github.com/Annoto/moodle-local-js/commit/abef52883b1814edecd32d17d4a8fb4d00f55349))

## [1.3.3](https://github.com/Annoto/moodle-local-js/compare/1.3.2...1.3.3) (2024-10-06)


### Bug Fixes

* stop propagation of click events from widget to prevent moodle dialog from closing ([#16](https://github.com/Annoto/moodle-local-js/issues/16)) ([89e4c5a](https://github.com/Annoto/moodle-local-js/commit/89e4c5aa8e46652406da29edbd140811d7c68ed4))

## [1.3.2](https://github.com/Annoto/moodle-local-js/compare/1.3.1...1.3.2) (2024-08-14)


### Bug Fixes

* tiles format support ([#14](https://github.com/Annoto/moodle-local-js/issues/14)) ([e963260](https://github.com/Annoto/moodle-local-js/commit/e9632600ad6aa6c9a25a12de461e70d86e2ea323))

## [1.3.1](https://github.com/Annoto/moodle-local-js/compare/1.3.0...1.3.1) (2024-08-13)


### Bug Fixes

* snap theme support ([#12](https://github.com/Annoto/moodle-local-js/issues/12)) ([cb4e2d9](https://github.com/Annoto/moodle-local-js/commit/cb4e2d9a519582e1c97d552d5469a4eb94c094b2))

## [1.3.0](https://github.com/Annoto/moodle-local-js/compare/1.2.0...1.3.0) (2024-04-29)


### Features

* Annoto completion support for Annoto LTI assignments ([#10](https://github.com/Annoto/moodle-local-js/issues/10)) ([b87f679](https://github.com/Annoto/moodle-local-js/commit/b87f679c87e838b6700e496123a641153a7d285f))

## [1.2.0](https://github.com/Annoto/moodle-local-js/compare/1.1.0...1.2.0) (2024-01-17)


### Features

* activity completion ([#8](https://github.com/Annoto/moodle-local-js/issues/8)) ([e1868d6](https://github.com/Annoto/moodle-local-js/commit/e1868d6e45573dceeb34ce6035df29a2392f17b8))

## [1.1.0](https://github.com/Annoto/moodle-local-js/compare/1.0.1...1.1.0) (2024-01-04)


### Features

* add support for mod tabs with nested divs ([9a771f9](https://github.com/Annoto/moodle-local-js/commit/9a771f95edc9205b0b35255fdae935cb52144cba))

## [1.0.1](https://github.com/Annoto/moodle-local-js/compare/1.0.0...1.0.1) (2024-01-01)


### Bug Fixes

* widget positioning on scroll for moodle v4.0 - v.4.2 ([9def84e](https://github.com/Annoto/moodle-local-js/commit/9def84e1aa7f381eb5f6608147cc2351a35f9ac6))

## [1.0.0](https://github.com/Annoto/moodle-local-js/compare/v0.3.3...1.0.0) (2023-12-27)


### Features

* init ([bf1fed4](https://github.com/Annoto/moodle-local-js/commit/bf1fed4a3dce52df5a32768409c787a27ec8bd25))


### Miscellaneous Chores

* release 1.0.0 ([9ec4e3d](https://github.com/Annoto/moodle-local-js/commit/9ec4e3d8ba3b735f8c8cac97804a0b918139237b))
* release 1.0.0 ([e0e22c1](https://github.com/Annoto/moodle-local-js/commit/e0e22c184bd9a1411b5653fea6389224ecc2df21))

## Changelog
