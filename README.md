# txt2tags.js 

A JavaScript port of txt2tags (based on showdown)




## Original Attributions

Showdown Copyright (c) 2007 John Fraser.
<http://www.attacklab.net/>

Original Markdown Copyright (c) 2004-2005 John Gruber
<http://daringfireball.net/projects/markdown/>

Redistributable under a BSD-style open source license.
See license.txt for more information.

Showdown maintained by Corey Innis https://github.com/coreyti and others

txt2tags.js hack by Eric F.


## Quick Example

```js
var Txt2tags = require('txt2tags');
var converter = new Txt2tags.converter();

converter.makeHtml('== hello txt2tags! ==');

// <h2 id="hellotxt2tags">hello, txt2tags!</h2>
```

## What's it for?

Developers can use Txt2tags.js to:

  * Add in-browser preview to existing Txt2tags apps

    Txt2tags.js' output is (almost always) identical to
    txt2tags.py's, so the server can reproduce exactly
    the output that the user saw.  (See below for
    exceptions.)

  * Add Txt2tags input to programs that don't support it

    Any app that accepts HTML input can now be made to speak
    Txt2tags by modifying the input pages's HTML.  If your
    application lets users edit documents again later,
    then they won't have access to the original Txt2tags
    text.  But this should be good enough for many
    uses -- and you can do it with just a two-line
    `onsubmit` function!

  * Add Txt2tags input to closed-source web apps

    You can write bookmarklets or userscripts to extend
    any standard textarea on the web so that it accepts
    Txt2tags instead of HTML.  With a little more hacking,
    the same can probably be done with  many rich edit
    controls.

  * Build new web apps from scratch

    A Txt2tags.js front-end can send back text in Txt2tags,
    HTML or both, so you can trade bandwidth for server
    load to reduce your cost of operation.  If your app
    requires JavaScript, you won't need to do any
    Txt2tags processing on the server at all.  (For most
    uses, you'll still need to sanitize the HTML before
    showing it to other users -- but you'd need to do
    that anyway if you're allowing raw HTML in your
    Txt2tags.)


## Browser Compatibility

Txt2tags.js has been tested successfully with:

  * Firefox 1.5 and 2.0
  * Internet Explorer 6 and 7
  * Safari 2.0.4
  * Opera 8.54 and 9.10
  * Netscape 8.1.2
  * Konqueror 3.5.4

In theory, Txt2tags.js will work in any browser that supports ECMA 262 3rd Edition (JavaScript 1.5).  The converter itself might even work in things that aren't web browsers, like Acrobat.  No promises.




## Known Differences in Output

In most cases, Txt2tags' output is identical to that of Python Txt2tags v2.6.  What follows is a list of all known deviations.  Please file an issue if you find more.

  * Tables
  * some ordered sublists
  * definition lists


## Tests (TODO)

A suite of tests is available which require node.js.  Once node is installed, run the following command from the project root to install the development dependencies:

    npm install --dev

Once installed the tests can be run from the project root using:

    npm test

New test cases can easily be added.  Create a markdown file (ending in `.md`) which contains the markdown to test.  Create a `.html` file of the exact same name.  It will automatically be tested when the tests are executed with `mocha`.




## Credits

  * Origins
    * 
  * Maintenance/Contributions 
    * 
