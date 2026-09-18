# Icon sources

All icons are inlined as SVG at build time (`build.py`: `_load_svg_body()` /
`icon()`), so the site loads no icon webfont. Sizing comes from CSS
(`.icon`, `.contact-item .contact-icon`).

| File | Source | License |
| --- | --- | --- |
| `graduation-cap.svg`, `address-card.svg`, `envelope.svg`, `envelope-open.svg`, `download.svg` | [Bootstrap Icons](https://icons.getbootstrap.com/) — `mortarboard`, `person-vcard`, `envelope`, `envelope-open`, `download` | MIT |
| `github.svg`, `orcid.svg`, `researchgate.svg`, `google-scholar.svg`, `scopus.svg`, `webofscience.svg` | [Simple Icons](https://simpleicons.org/) | CC0 1.0 |

Brand marks remain the property of their respective owners and are used here only
to link to the author's profiles on those services.

To add an icon, drop `<name>.svg` here and reference it as `icon("<name>")` in
`build.py` (contact entries use the `("svg", "<name>", ...)` tuple).
