# Changelog

## [1.1.6](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.5...react-v1.1.6) (2026-05-05)


### Bug Fixes

* render knight arrows as bent paths ([bc99efc](https://github.com/yahorbarkouski/ultrachess-react/commit/bc99efcc9a0ee0d3094ee195827c38cc4c720478))

## [1.1.5](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.4...react-v1.1.5) (2026-05-04)


### Bug Fixes

* format controlled board memo wrapper ([9286bb0](https://github.com/yahorbarkouski/ultrachess-react/commit/9286bb01eae3eed5ad1dc9360055ebc190d69e85))
* optimize controlled analysis board updates ([cfb52bd](https://github.com/yahorbarkouski/ultrachess-react/commit/cfb52bd910104f0a45c00f9f350684d6e9642811))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @ultrachess/core bumped from 1.1.2 to 1.1.3

## [1.1.4](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.3...react-v1.1.4) (2026-05-04)


### Bug Fixes

* **react:** publish versioned internal dependencies ([c4c0334](https://github.com/yahorbarkouski/ultrachess-react/commit/c4c03343abdd14da8d720ba46b81096635687244))

## [1.1.3](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.2...react-v1.1.3) (2026-05-04)


### Bug Fixes

* added positionFen and positionTransition ([b8c2b96](https://github.com/yahorbarkouski/ultrachess-react/commit/b8c2b96c2ca23a58eab2aeb9ab04c9c293c1016d))

## [1.1.2](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.1...react-v1.1.2) (2026-05-02)


### Documentation

* better benchmarking ([0943511](https://github.com/yahorbarkouski/ultrachess-react/commit/0943511ba7342a2f851d8f867840b5e1fe4ef2f8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @ultrachess/core bumped to 1.1.2

## [1.1.1](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.1.0...react-v1.1.1) (2026-04-19)


### Bug Fixes

* replace hype taglines with concrete numbers + populate npm keywords ([e4317cc](https://github.com/yahorbarkouski/ultrachess-react/commit/e4317cc95479f898583944e9450e212da3b0bc37))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @ultrachess/core bumped to 1.1.1

## [1.1.0](https://github.com/yahorbarkouski/ultrachess-react/compare/react-v1.0.0...react-v1.1.0) (2026-04-19)


### Features

* **M6:** chess.com move sounds, piece sets, and themes ([a5240ba](https://github.com/yahorbarkouski/ultrachess-react/commit/a5240bafd94d941270f8bdbbf534ff97ec68617e))
* **react:** M2 interactive chessboard — click-to-move, themed, layered rendering ([89a3c7f](https://github.com/yahorbarkouski/ultrachess-react/commit/89a3c7f4836e151b76f0e36c99b509587ee33afb))
* **react:** M3 drag + FLIP animations + promotion ([58a493d](https://github.com/yahorbarkouski/ultrachess-react/commit/58a493dda863f8ff52f74c5ac612c842136f98a3))
* **react:** M4 arrows + premoves + check/flash highlights + drag UX polish ([30b7a41](https://github.com/yahorbarkouski/ultrachess-react/commit/30b7a414e1be0e0af99f71f4ec28512a829af37b))
* **react:** M5 keyboard navigation + screen-reader announcer + static SSR board ([ea76d3c](https://github.com/yahorbarkouski/ultrachess-react/commit/ea76d3ca53a0077af19ac90404fcf742feb6daf4))


### Bug Fixes

* **react:** default allowPremove to false; flash red on wrong-turn drag ([4653095](https://github.com/yahorbarkouski/ultrachess-react/commit/4653095f9bf4476985f5cbf11391ad6d9ddcfb59))
* **react:** useChessGame infinite loop — drop modelOptions from useEffect deps ([bcf64ab](https://github.com/yahorbarkouski/ultrachess-react/commit/bcf64abdde86f5660864e80ed7bdea8457a356dd))


### Performance

* **react:** chessground-style imperative last-move controller ([ff93749](https://github.com/yahorbarkouski/ultrachess-react/commit/ff937491e106ec2712fc6f42c738d40a90e4db24))
* **react:** chessground-style imperative selection controller ([e655e2d](https://github.com/yahorbarkouski/ultrachess-react/commit/e655e2d8fc97157163ecf386ea3f404b3896337e))
* **react:** element pool, grid-area placement, imperative drag layer ([f27eed8](https://github.com/yahorbarkouski/ultrachess-react/commit/f27eed819f742abd32f1dbc325da5c9a4f7aaf49))
* **react:** stop &lt;Chessboard/&gt; re-rendering per move + 3-way Playwright bench ([ff257c4](https://github.com/yahorbarkouski/ultrachess-react/commit/ff257c42283adbf8e6c55a81982af2032771e8ce))


### Documentation

* readme and benches ([cbafafb](https://github.com/yahorbarkouski/ultrachess-react/commit/cbafafbdec0bc704733811cef080ab20eac1c76f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @ultrachess/core bumped to 1.1.0
