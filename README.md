# Moodle Local Annoto plugin Javascript

This repo contains the Javascript code for the [Annoto Moodle local plugin](https://github.com/Annoto/moodle-local_annoto)
The code is written in [Typescript].

[typescript]: https://www.typescriptlang.org/

## Getting Started


The script is served from Anntoo CDN at: https://cdn.annoto.net/moodle-local-js/latest/annoto.js

Specific versions are available as well, for example: https://cdn.annoto.net/moodle-local-js/1.0.0/annoto.js

Staging is available at: https://cdn.annoto.net/staging/moodle-local-js/latest/annoto.js

The library is exported as UMD under name of `AnnotoMoodle`

### Installing

Clone and run npm to install dependencies:

```sh
git clone https://github.com/Annoto/moodle-local-js.git
cd moodle-local-js
npm install
```

### Building

To build for production run:

```sh
npm run build
```

### Developing

To start developing run:

```sh
npm run dev
```

Visit http://localhost:9002/annoto.js

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [releases on this repository](https://github.com/Annoto/playkit-plugin/releases).

## License

This project is licensed under the Apache 2.0 License License - see the [LICENSE](LICENSE) file for details.
