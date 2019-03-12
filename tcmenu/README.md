# menubar

The **menubar** allows for vertical and horizontal buttons and selections
(fields, drill-down dimensions, master dimensions and variables) as well as unlimited trigger based Actions.

In addition, you can share apps with the current selection with a single click, as well as conveniently chain
documents including current or changed selections to navigate between apps.

This visualization extension supports [Qlik Sense®](http://www.qlik.com/us/products/qlik-sense)
from version 3.0.0 up to currently latest version June and upcoming version February 2019 including exporting and story mode capability.

[Get menubar!](https://www.truechart.com/downloads/menubar/)

![menubar Example](./assets/example.gif)

## Features

* **Responsive** vertical and horizontal design
** **Dynamic font sizing** optional responsive font sizing depending on the width of the menubar object
** **Hide elements in Sense mobile view** optional hide elements in mobile view
* Create **buttons** and assign _Triggers_ and _Actions_ to
  - **navigation** through Qlik Sense and within self-created mashups,
  - one click **app sharing** and **document chaining**,
  - **make selections** (upon button click, after page loading, after selection,
  bevor navigation or based on your own JS-based custom trigger event),
  - created individual actions based on your own JS code,
* **Alternate state support** for all supported Qlik Sense versions from 3.0
* Comprehensive **Button Editor** for button styling,
* Create _Select_ widgets to make **selections** from (drill-down) dimensions or use sliders for it.
* Create _Date Picker_ widgets to **select single, multi, range dates** and **custom ranges** by one click
* Create _Variable_ widgets to set **variable values** just by a click, with **variable sliders** or by a **variable input** boxes
* **Sheet styling** use colors or images to style the sheet background
* **Maximum space gain** by optionally hiding the Qlik Sense® menus
(menu, selection and title bar) and _Toggle fullscreen_ action
* **Reduction of visual noise** by optional _hiding of snapshot and maximizing buttons_

## Update

### What is new in menubar v1.4.x

**New name and logo**
With version 1.4.0 the extension got renamed and is now called Menubar. With the new name the Menubar also got a brand new logo.

![New Menubar logo](./assets/menubar-logo.png)

**New Element Field Slider**
The _Field Slider_ allows to select values of a dimension with a slider component.

![Field Slider examples](./assets/field-slider-examples.png)

**Dynamic font sizing**
The option to set the font size dynamically allows for responsive font sizing depending on the width of the extension object.

**Hide elements in Sense mobile view**
Now you can hide {menubar} elements when Qlik Sense is in mobile mode. Just activate the checkbox in the property panel and the element is not active in
 Sense mobile mode. Inactive elements dont trigger any actions or behaviors such as the default selections.

**Individual colors for all elements**
Individual colors can be defined for every element of the {menubar}. There is no limitation on what you want to style. Even the funkiest {menubar}s can now be
designed.

![Individual Colors](./assets/whats-new-colors.png)

**Option to style sheet background**
The option to style the sheet background allows you to style the Sense sheet background with an
image, color or both. This also works in storymode if a {menubar} elements is placed on the slide and has an active background styling.

![Sheet with Background styling](./assets/whats-new-background.png)

## Showcase

### Selection and navigation

![Selection and navigation](./assets/selection-and-navigation.gif)

### Triggers and actions

![Triggers and actions](./assets/triggers-and-actions.gif)

## Prerequisites

### Qlik Sense® Support
menubar supports Qlik Sense® from version 3.0.0 up to currently
latest version June and upcoming version February 2019 including exporting and story mode capability.

#### nPrinting Support
The menubar does support nPrinting from version June 2018.

### Browser Support
At present menubar supports the browsers listed below:

* Microsoft Internet Explorer 11
* Microsoft Edge (lastest version - v42, at the time of writing)
* Mozilla Firefox (latest version – v65, at the time of writing)
* Google Chrome (latest version – v72, at the time of writing)
* iOS 10.3.2 or later
** We recommend upgrading to iOS 11.2.2 or later.

The indicated versions are the minimum conditions. In each case, the latest
version is to be preferred.

## Download and installation

Here you will find the free trial version, which can be used directly in Qlik Sense®. The free trial version contains
the full feature set of menubar, but has as an addition a fix menubar element at the end which shows the logo and
provides a link to the trueChart homepage (https://www.truechart.com/menubar).

For information about the full licensing or trial version of the menubar, please get in contact: info@highcoordination.de.

[Get menubar!](https://www.truechart.com/downloads/menubar/)

### _Qlik Sense Desktop_

For _Qlik Sense Desktop_, simply extract the contents of the ZIP file to your
`Documents/Qlik/Sense/Extensions` folder.

### _Qlik Sense Server_

1. Enter the QMC and navigate to **Manage Resources** → **Extensions**
2. Click the **Import** button at the bottom,
3. In the pop-up dialog, click on **Choose File** to browse the downloaded folder,
4. Click on **Import**.

## Build

In order to further develop the menubar, the git-repo must first be cloned.
Next, run the `setup.sh` script. It will install npm dependencies for all modules.

Then perform the following step inside the tcmenu folder to build an extension that can be used in Qlik Sense®:

1. `npm run build`
2. `npm run zip` -> builds/tcmenu-[version]_dev.zip

Or just run `npm start` inside the tcmenu folder. This will build the menubar, move it to the Documents/Extension folder
and watch for changes.

## Documentation

The menubar also includes a complete user documentation and from
installation, configuration to use everything is explained.
The documentation can be accessed through properties panel **Display** → **Info**
via link **Online Manual** or directly here [User Manual](https://www.trueChart.com/guides/menubar/current/).

## Contacts
* Product [trueChart](http://www.truechart.com)
* Web: [HighCoordination GmbH](https://www.highcoordination.com/en)
* Email: [info@highcoordination.de](mailto:info@highcoordination.de)
* Twitter: [Hi_Coordination](https://twitter.com/Hi_Coordination)
* Facebook: [HighCoordination](https://www.facebook.com/HighCoordination)
* LinkedIn: [highcoordination-gmbh](https://www.linkedin.com/company/highcoordination-gmbh)
* Xing: [highcoordinationgmbh](https://www.xing.com/companies/highcoordinationgmbh)

## Links
* [trueChart Website](http://www.truechart.com)
* [Buy menubar support](https://www.truechart.com/contact)
* [menubar Support](mailto:support@truechart.com)
* [menubar Demo](https://www.truechart.com/demo)

## License

This project is licensed under the terms of the [Apache 2.0 license](./LICENSE).

The project published here can be used directly, but without support.
For menubar a commercial license including support can be purchased
via HighCoordination. In particular, this includes support for future versions of
Qlik Sense® and technical support.

[Buy menubar support](https://www.truechart.com/contact)

If you have any questions regarding licensing - please [contact us](https://www.truechart.com/contact).