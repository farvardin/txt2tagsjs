//
// showdown-gui.js
//
// A sample application for Showdown, a javascript port
// of Markdown.
//
// Copyright (c) 2007 John Fraser.
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution is at:
//
//				A A L
//				T C A
//				T K B
//
//   <http://www.attacklab.net/>
//

//
// The Showdown converter itself is in showdown.js, which must be
// included by the HTML before this file is.
//
// showdown-gui.js assumes the id and class definitions in
// showdown.html.  It isn't dependent on the CSS, but it does
// manually hide, display, and resize the individual panes --
// overriding the stylesheets.
//
// This sample application only interacts with showdown.js in
// two places:
//
//  In startGui():
//
//      converter = new Showdown.converter();
//
//  In convertText():
//
//      text = converter.makeHtml(text);
//
// The rest of this file is user interface stuff.
//


//
// Register for onload
//
window.onload = startGui;


//
// Globals
//

var converter;
var convertTextTimer,processingTime;
var lastText,lastOutput,lastRoomLeft;
var convertTextSetting, convertTextButton, paneSetting;
var inputPane,previewPane,outputPane,syntaxPane;
var maxDelay = 3000; // longest update pause (in ms)
var scrollActivate = false;
var tab = {"line": 10, "col": 10};
//
//	Initialization
//

function startGui() {
	// find elements
	convertTextSetting = document.getElementById("convertTextSetting");
	convertTextButton = document.getElementById("convertTextButton");
	paneSetting = document.getElementById("paneSetting");

	inputPane = document.getElementById("inputPane");
	previewPane = document.getElementById("previewPane");
	outputPane = document.getElementById("outputPane");
	syntaxPane = document.getElementById("syntaxPane");

	// set event handlers
	convertTextSetting.onchange = onConvertTextSettingChanged;
	convertTextButton.onclick = onConvertTextButtonClicked;
	paneSetting.onchange = onPaneSettingChanged;
	window.onresize = setPaneHeights;

	// First, try registering for keyup events
	// (There's no harm in calling onInput() repeatedly)
	window.onkeyup = inputPane.onkeyup = onInput;

	// In case we can't capture paste events, poll for them
	var pollingFallback = window.setInterval(function(){
		if(inputPane.value != lastText)
			onInput();
	},1000);

	// Try registering for paste events
	inputPane.onpaste = function() {
		// It worked! Cancel paste polling.
		if (pollingFallback!=undefined) {
			window.clearInterval(pollingFallback);
			pollingFallback = undefined;
		}
		onInput();
	}

	// Try registering for input events (the best solution)
	if (inputPane.addEventListener) {
		// Let's assume input also fires on paste.
		// No need to cancel our keyup handlers;
		// they're basically free.
		inputPane.addEventListener("input",inputPane.onpaste,false);
	}

	// poll for changes in font size
	// this is cheap; do it often
	window.setInterval(setPaneHeights,250);

	// start with blank page?
	if (top.document.location.href.match(/\?blank=1$/))
		inputPane.value = "";

	// refresh panes to avoid a hiccup
	onPaneSettingChanged();

	// build the converter
	converter = new Txt2tags.converter();

	// do an initial conversion to avoid a hiccup
	convertText();

	// give the input pane focus
	inputPane.focus();

	createPreTable(tab["line"],tab["col"]);
	inputPane.addEventListener('DOMMouseScroll', wheel, false);
	previewPane.addEventListener('DOMMouseScroll', wheel, false);
	outputPane.addEventListener('DOMMouseScroll', wheel, false);
	syntaxPane.addEventListener('DOMMouseScroll', wheel, false);
	switchSync();

	// start the other panes at the top
	// (our smart scrolling moved them to the bottom)
	previewPane.scrollTop = 0;
	outputPane.scrollTop = 0;
}


//
//	Conversion
//

function convertText() {
	// get input text
	var text = inputPane.value;
	
	// if there's no change to input, cancel conversion
	if (text && text == lastText) {
		return;
	} else {
		lastText = text;
	}

	var startTime = new Date().getTime();

	// Do the conversion
	text = converter.makeHtml(text);

	// display processing time
	var endTime = new Date().getTime();	
	processingTime = endTime - startTime;
	document.getElementById("processingTime").innerHTML = processingTime+" ms";

	// save proportional scroll positions
	saveScrollPositions();

	// update right pane
	if (paneSetting.value == "outputPane") {
		// the output pane is selected
		outputPane.value = text;
	} else if (paneSetting.value == "previewPane") {
		// the preview pane is selected
		previewPane.innerHTML = text;
	}

	lastOutput = text;

	// restore proportional scroll positions
	restoreScrollPositions();
};


//
//	Event handlers
//

function onConvertTextSettingChanged() {
	// If the user just enabled automatic
	// updates, we'll do one now.
	onInput();
}

function onConvertTextButtonClicked() {
	// hack: force the converter to run
	lastText = "";

	convertText();
	updateTime();
	inputPane.focus();
}

function onPaneSettingChanged() {
	previewPane.style.display = "none";
	outputPane.style.display = "none";
	syntaxPane.style.display = "none";

	// now make the selected one visible
	top[paneSetting.value].style.display = "block";

	lastRoomLeft = 0;  // hack: force resize of new pane
	setPaneHeights();

	if (paneSetting.value == "outputPane") {
		// Update output pane
		outputPane.value = lastOutput;
	} else if (paneSetting.value == "previewPane") {
		// Update preview pane
		previewPane.innerHTML = lastOutput;
	}
}

function onInput() {
// In "delayed" mode, we do the conversion at pauses in input.
// The pause is equal to the last runtime, so that slow
// updates happen less frequently.
//
// Use a timer to schedule updates.  Each keystroke
// resets the timer.

	// if we already have convertText scheduled, cancel it
	if (convertTextTimer) {
		window.clearTimeout(convertTextTimer);
		convertTextTimer = undefined;
	}

	if (convertTextSetting.value != "manual") {
		var timeUntilConvertText = 0;
		if (convertTextSetting.value == "delayed") {
			// make timer adaptive
			timeUntilConvertText = processingTime;
		}

		if (timeUntilConvertText > maxDelay)
			timeUntilConvertText = maxDelay;

		// Schedule convertText().
		// Even if we're updating every keystroke, use a timer at 0.
		// This gives the browser time to handle other events.
		convertTextTimer = window.setTimeout(convertText,timeUntilConvertText);
	}
}


//
// Smart scrollbar adjustment
//
// We need to make sure the user can't type off the bottom
// of the preview and output pages.  We'll do this by saving
// the proportional scroll positions before the update, and
// restoring them afterwards.
//

var previewScrollPos;
var outputScrollPos;

function getScrollPos(element) {
	// favor the bottom when the text first overflows the window
	if (element.scrollHeight <= element.clientHeight)
		return 1.0;
	return element.scrollTop/(element.scrollHeight-element.clientHeight);
}

function setScrollPos(element,pos) {
	element.scrollTop = (element.scrollHeight - element.clientHeight) * pos;
}

function saveScrollPositions() {
	previewScrollPos = getScrollPos(previewPane);
	outputScrollPos = getScrollPos(outputPane);
}

function restoreScrollPositions() {
	// hack for IE: setting scrollTop ensures scrollHeight
	// has been updated after a change in contents
	previewPane.scrollTop = previewPane.scrollTop;

	setScrollPos(previewPane,previewScrollPos);
	setScrollPos(outputPane,outputScrollPos);
}

//
// Textarea resizing
//
// Some browsers (i.e. IE) refuse to set textarea
// percentage heights in standards mode. (But other units?
// No problem.  Percentage widths? No problem.)
//
// So we'll do it in javascript.  If IE's behavior ever
// changes, we should remove this crap and do 100% textarea
// heights in CSS, because it makes resizing much smoother
// on other browsers.
//

function getTop(element) {
	var sum = element.offsetTop;
	while(element = element.offsetParent)
		sum += element.offsetTop;
	return sum;
}

function getElementHeight(element) {
	var height = element.clientHeight;
	if (!height) height = element.scrollHeight;
	return height;
}

function getWindowHeight(element) {
	if (window.innerHeight)
		return window.innerHeight;
	else if (document.documentElement && document.documentElement.clientHeight)
		return document.documentElement.clientHeight;
	else if (document.body)
		return document.body.clientHeight;
}

function setPaneHeights() {
	var roomLeft;
	var markItUpHeight = 0;
	var screen = window.innerWidth > 799;
	if(document.getElementById('markItUpInputPane')) {
		markItUpHeight = getElementHeight(document.getElementById('markItUpInputPane'))
					   - getElementHeight(inputPane);
	}
	
	var footer = document.getElementById("footer");

	var windowHeight = getWindowHeight();
	var footerHeight = getElementHeight(footer);
	var textareaTop = getTop(inputPane);
	// figure out how much room the panes should fill
	if(screen) {
		roomLeft = windowHeight - footerHeight - textareaTop;
	} else {
		roomLeft = windowHeight*0.35;
	}
	if (roomLeft < 300) roomLeft = 300;
	// if it hasn't changed, return
	if (roomLeft == lastRoomLeft && !(window.innerWidth > 799)) {
		return;
	}
	lastRoomLeft = roomLeft;
	
	// resize all panes
	inputPane.style.height = roomLeft + "px";
	previewPane.style.height = roomLeft + markItUpHeight + "px";
	outputPane.style.height = roomLeft + markItUpHeight + "px";
	syntaxPane.style.height = roomLeft + markItUpHeight + "px";
	if(!(window.innerWidth > 799)) updateTop(true);
	else updateTop(false);
}

function updateTop(bool) {
	if(bool) {
		document.getElementById('leftContainer').style.top = "0";
		document.getElementById('rightContainer').style.top = getElementHeight(document.getElementById('leftContainer')) + 20 +"px";
	} else {
		document.getElementById('leftContainer').style.top = "0";
		document.getElementById('rightContainer').style.top = "0";
	}
}

function switchPlace() {
	var scrollPos = document.body.scrollTop;
	var left = document.getElementById('leftContainer');
	var right = document.getElementById('rightContainer');
	left.setAttribute("class", "switch");
	right.setAttribute("class", "switch");
	left.setAttribute("id", "rightContainer");
	right.setAttribute("id", "leftContainer");
	setPaneHeights();
	if(!(window.innerWidth > 799)) {
		right.style.top = "0";
		left.style.top = getElementHeight(document.getElementById('leftContainer')) + 20 + "px";
	}
	
	setTimeout(function() {
		left.setAttribute("class","");
		right.setAttribute("class","");
		document.body.scrollTop = scrollPos;
	}, 500);
}

function change() {
	temp = valueOfPlace[0];
	valueOfPlace[0] = valueOfPlace[1];
	valueOfPlace[1] = temp;
}

var sync = function(idScroll) {	
	if(idScroll) {
		previewPane.scrollTop = Math.round(inputPane.scrollTop / (inputPane.scrollHeight - inputPane.offsetHeight)
							  * (previewPane.scrollHeight - previewPane.offsetHeight));
		outputPane.scrollTop = Math.round(inputPane.scrollTop / (inputPane.scrollHeight - inputPane.offsetHeight)
							  * (outputPane.scrollHeight - outputPane.offsetHeight));
		syntaxPane.scrollTop = Math.round(inputPane.scrollTop / (inputPane.scrollHeight - inputPane.offsetHeight)
							  * (syntaxPane.scrollHeight - syntaxPane.offsetHeight));
	} else {
		if(paneSetting.value == "previewPane") {
			inputPane.scrollTop = Math.round(previewPane.scrollTop / (previewPane.scrollHeight - previewPane.offsetHeight)
								* (inputPane.scrollHeight - inputPane.offsetHeight));
		} else if(paneSetting.value == "outputPane") {
			inputPane.scrollTop = Math.round(outputPane.scrollTop / (outputPane.scrollHeight - outputPane.offsetHeight)
								* (inputPane.scrollHeight - inputPane.offsetHeight));
		} else if(paneSetting.value == "syntaxPane"){
			inputPane.scrollTop = Math.round(syntaxPane.scrollTop / (syntaxPane.scrollHeight - syntaxPane.offsetHeight)
								* (inputPane.scrollHeight - inputPane.offsetHeight));
		}
	}
}

var switchSync = function() {
	if(scrollActivate) {
		inputPane.setAttribute("onscroll","");
		previewPane.setAttribute("onscroll","");
		outputPane.setAttribute("onscroll","");
		syntaxPane.setAttribute("onscroll","");
		document.getElementById('synchronizeButton').style.backgroundColor = "rgb(255,60,0)";
	} else {
		inputPane.setAttribute("onscroll","sync(true)");
		previewPane.setAttribute("onscroll","sync(false)");
		outputPane.setAttribute("onscroll","sync(false)");
		syntaxPane.setAttribute("onscroll","sync(false)");
		document.getElementById('synchronizeButton').style.backgroundColor = "rgb(0,230,80)";
	}
	scrollActivate = !scrollActivate;
}

function wheel(event) {
	if (event.detail) {
		this.scrollTop += (event.detail/3)*100;
		event.preventDefault;
	}
	event.returnValue = false;
}

function updateTime() {
	time = document.getElementById('processingTime');
	time.style.transition = '';
	time.style.backgroundColor = 'white';
	setTimeout(function() {
		time.style.transition = 'background-color 300ms';
		time.style.backgroundColor = 'rgba(255,255,255,0)';
	}, 200);
}

var tabSizeHover = function(line, col) {
	for(var i = 1; i <= tab["line"]; i++) {
		for(var j = 1; j <= tab["col"]; j++) {
			if(i <= line && j <= col) {
				document.getElementById("l" + i + "c" + j).style.backgroundColor = "rgba(200,200,200,0.8)";
			} else {
				document.getElementById("l" + i + "c" + j).style.backgroundColor = "rgba(230,230,230,0.8)";
			}
		}
	}
}

var createTab = function(line, col) {
	document.getElementById('tabSize').style.display = "none";
	var scrollPos = inputPane.scrollTop;
	var pos = Math.max(inputPane.selectionStart, inputPane.selectionEnd);
	var selection = "\n|";
	for(var i = 0; i < line; i++) {
		for(var j = 0; j < col; j++) {
			if(i == 0 && j == 0) selection += "| item";
			else selection += " | item";
		}
		selection += " |\n";
	}
	selection += "\n";
	
	var cursPos = pos + selection.length;
	inputPane.value = inputPane.value.substring(0, pos) + selection + inputPane.value.substring(pos, inputPane.value.length);
	inputPane.focus();
	inputPane.setSelectionRange(cursPos, cursPos);
	inputPane.scrollTop = scrollPos;
	previewPane.scrollTop = scrollPos;
	onConvertTextButtonClicked();
}

function createPreTable(l,c) {
	var table = '<table><thead onclick="cancelTab()" onmouseover="tabSizeHover(0,0)"><td colspan=' +c+ '>Annuler</thead><tr>';
	for(var i = 1; i <= l; i++) {
		table += '<td id="l1c' +i+'" onmouseover="tabSizeHover(1,' +i+ ')" onclick="createTab(1,' +i+ ')">' + i;
	}
	for(var i = 2; i <= l; i++) {
		table += '<tr>';
		for(var j = 1; j <= c; j++) {
			table += '<td id="l' +i+ 'c' +j+'" onmouseover="tabSizeHover(' +i+ ',' +j+ ')" onclick="createTab(' +i+ ',' +j+ ')">' + (j == 1 ? i : '');
		}
	}
	table += '</table>';
	document.getElementById('tabSize').innerHTML = table;
}

function cancelTab() {
	document.getElementById('tabSize').style.display = "none";
}