//
// txt2tagsjs-gui.js
//
// 2015-07-21
//
// A sample application for Showdown, a javascript port
// of --Markdown-- txt2tags.
//
// Copyright (c) 2007 John Fraser.
//
// Redistributable under a BSD-style open source license.
// See license.txt for more information.
//
// The full source distribution was at:
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


if(typeof wons == "undefined")
	wons = new Array();

wons.push(startGui);

window.onload = function() {
	for(var i = 0; i < wons.length; i++)
		wons[i]();
}


//
// Globals
//

var converter;
var convertTextTimer,processingTime;
var lastText,lastOutput,lastRoomLeft,lastHeight;
var inputPane,previewPane,outputPane,syntaxPane;
var maxDelay = 3000;						// Longest update pause (in ms)
var scrollSynchro = true;					// Synchronized scrolling
var typeDisplay = "inline-block";			// "inline" or "block"
var displayPreview = true;					// Show previewPane
var initSizePane = 400;						// First size of inputPane
var tabMarkItUp = {"line": 10, "col": 10};	// Size of MarkItUp automatic table

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

	//createPreTable(tab["line"],tab["col"]);
	inputPane.addEventListener('DOMMouseScroll', wheel, false);
	previewPane.addEventListener('DOMMouseScroll', wheel, false);
	outputPane.addEventListener('DOMMouseScroll', wheel, false);
	syntaxPane.addEventListener('DOMMouseScroll', wheel, false);
	switchSync();

	// start the other panes at the top
	// (our smart scrolling moved them to the bottom)
	inputPane.scrollTop = 0;
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
		return 0;
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
	var height = 0;
	var fix;
	
	if(document.getElementById('inputPane')) {
		var markItUp = document.getElementById('markItUpInputPane') ? getElementHeight(document.getElementById('markItUpInputPane')) - getElementHeight(inputPane) : 0;
		var panesContainer = document.getElementById('panesContainer');
		fix = getElementHeight(inputPane) - (inputPane.style.height ? parseInt(inputPane.style.height) : getElementHeight(inputPane));
		height = Math.max(200,getElementHeight(inputPane) + markItUp);
		
		if(typeDisplay == "inline-block") {
			previewPane.style.height = height - fix + "px";
			outputPane.style.height = height - fix + "px";
			inputPane.style.height = height - markItUp - fix + "px";
			panesContainer.parentNode.style.height = (height + 30) + "px";
			document.getElementById('rightContainer').style.top = 0;
			document.getElementById('rightContainer').style.left = "51%";
		} else {
			previewPane.style.height = height + "px";
			outputPane.style.height = height + "px";
			inputPane.style.height = height - markItUp - fix + "px";
			panesContainer.parentNode.style.height = (height*(displayPreview ? 1 : 2) + 30) + "px";
			document.getElementById('rightContainer').style.top = (height + 15) + "px";
			document.getElementById('rightContainer').style.left = "0%";
		} 
		document.getElementById('leftContainer').style.top = 0;
		document.getElementById('leftContainer').style.left = "0%";
	} else if(document.getElementsByClassName('ajaxContentTextarea').length > 0) {
		for(var i = 0; i < document.getElementsByClassName('ajaxContentTextarea').length; i++) {
			fix = getElementHeight(document.getElementsByClassName('ajaxContentTextarea')[i])
				- (document.getElementsByClassName('ajaxContentTextarea')[i].style.height
				  ? parseInt(document.getElementsByClassName('ajaxContentTextarea')[i].style.height)
				  : getElementHeight(document.getElementsByClassName('ajaxContentTextarea')[i]));
			height = Math.max(200,getElementHeight(document.getElementsByClassName('ajaxContentTextarea')[i]));
			
			document.getElementsByClassName('ajaxContentTextarea')[i].style.height = height - fix + "px";
		}
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

function sync(idScroll) {	
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

function switchSync() {
	scrollSynchro = !scrollSynchro;
	if(scrollSynchro) {
		inputPane.setAttribute("onscroll","");
		previewPane.setAttribute("onscroll","");
		outputPane.setAttribute("onscroll","");
		document.getElementById('synchronizeButton').setAttribute("class", "txt2tagsMenu button_txt2tags_false");
		document.getElementById('synchronizeButton').style.backgroundColor = "rgb(255,60,0)";
	} else {
		inputPane.setAttribute("onscroll","sync(true)");
		previewPane.setAttribute("onscroll","sync(false)");
		outputPane.setAttribute("onscroll","sync(false)");
		syntaxPane.setAttribute("onscroll","sync(false)");
		document.getElementById('synchronizeButton').setAttribute("class", "txt2tagsMenu button_txt2tags_true");
		document.getElementById('synchronizeButton').style.backgroundColor = "rgb(0,230,80)";
	}
	// scrollActivate = !scrollActivate; // will block rendering if uncommented
}

function wheel(event) {
	if (event.detail) {
		this.scrollTop += (event.detail/3)*100;
		event.preventDefault;
	}
	event.returnValue = false;
}

function switchDisplay(display) {
	if(!display) {
		typeDisplay == "inline-block" ? display = "block" : display = "inline-block";
	}
	var left = document.getElementById("leftContainer");
	var right = document.getElementById("rightContainer");
	if(display == "inline-block") {
		left.style.display = "inline-block";
		right.style.display = "inline-block";
		left.style.width = displayPreview ? "100%" : "49%";
		right.style.width = displayPreview ? "100%" : "49%";
		typeDisplay = "inline-block";
	} else {
		left.style.display = "block";
		right.style.display = "block";
		left.style.width = "100%";
		right.style.width = "100%";
		typeDisplay = "block";
	}
}

function previewCache() {
	panesContainer = document.getElementById('panesContainer');
	if(previewPane.parentNode.id == "leftContainer") switchPlace();
	if(displayPreview) {
		previewPane.style.display = typeDisplay;
		if(typeDisplay == "inline-block") {
			document.getElementById("leftContainer").style.width = "49%";
			document.getElementById("rightContainer").style.width = "49%";
		} else inputPane.style.height = parseInt(inputPane.style.height)/2 + "px";
		document.getElementById('displayPreview').setAttribute("class", "txt2tagsMenu button_txt2tags_true");
		document.getElementById('changeButton').style.display = "inline-block";
		document.getElementById('displayPane').style.display = "inline-block";
		document.getElementById('synchronizeButton').style.display = "inline-block";
	} else {
		previewPane.style.display = "none";
		if(typeDisplay == "inline-block") {
			document.getElementById("leftContainer").style.width = "100%";
			document.getElementById("rightContainer").style.width = "100%";
		} else inputPane.style.height = parseInt(inputPane.style.height)*2 + "px";
		document.getElementById('displayPreview').setAttribute("class", "txt2tagsMenu button_txt2tags_false");
		document.getElementById('changeButton').style.display = "none";
		document.getElementById('displayPane').style.display = "none";
		document.getElementById('synchronizeButton').style.display = "none";
	}
	displayPreview = !displayPreview;
}