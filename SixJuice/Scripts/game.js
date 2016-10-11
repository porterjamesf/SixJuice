$(function () {

    //------------------------------------------
    //      PAGE & PLAYER MANAGEMENT
    //------------------------------------------

    var hub = $.connection.sixJuiceHub;
    roomCode = getRoomCode();
    playerName = getPlayerName();
    playerInfo = null;

    //Receives list of player info, triggering wait for players overlay showing/hiding
    hub.client.playersReady = function (players) {
        playerInfo = JSON.parse(players);

        allReady = true;
        if (gameOverNotShown) {
            $('#waitList').empty();
            for (var i = 0; i < playerInfo.length; i++) {
                if (!playerInfo[i].ready) {
                    $('#waitList').append('<span class="smallText spiv">'.concat(playerInfo[i].playerName, '</span>'));
                    allReady = false;
                }
            }
        }
        if (allReady) {
        	$('#wait').hide();
            if (playedQueensAndJacks.length > 0) { //Someone is reconnecting during queen/joc count down
                if (playerOKs[0] != playerName) { //I'm the queen/joc player: Send queen count down status w/ all ok's
                    hub.server.resQ(roomCode, queenCount, playedQueensAndJacks, queenJocPlayers, playerOKs);
                } else { //I'm not the queen/joc player: Send queen count down status w/ report of whether I've ok'd
                    hub.server.resQ(roomCode, queenCount, playedQueensAndJacks, queenJocPlayers, queenOK ? ["ok", playerName] : ["ok"]);
                }
            }
        } else {
            $('#wait').show();
            if (playedQueensAndJacks.length > 0) {
                queenPause = true;
            }
        }
    }

    //Identifies this connection to the server, associating it with the room and player
    hub.client.identify = function () {
        hub.server.identify(playerName, roomCode);
    }

    //Triggers OnDisconnected immediately no matter how the user leaves the page
    window.onbeforeunload = function () {
        hub.server.stopConnection();
    }

    //History management helpers used in _SJLayout script
    pushCurrentState = function () {
        history.pushState({ scrn: "Game", rc: roomCode, sub: null }, "Game " + roomCode, window.location);
    }
    firePopstate = function (e) {
        if (e.state == null || e.state.sub == null) {
            hideKingOverlay();
        }
    };

    //Helper for URL construction
    getBaseURL = function () {
        pathArray = location.href.split('/');
        protocol = pathArray[0];
        host = pathArray[2];
        return protocol.concat('//', host);
    }

    //Game joining callback to ensure the player we're joining as is not already joined
    hub.client.idConfirm = function (isConfirmed) {
        if (isConfirmed) {
            hub.server.joinGameAs(roomCode, playerName);
            hub.server.getPlayerGameState(roomCode, playerName);
        } else {
            window.location.href = getBaseURL().concat('/Start/?roomCode=', roomCode, '&message=That player is already playing.');
        }
    }

    $.connection.hub.start().done(function () {
        hub.server.confirmId(roomCode, playerName);
    });

    //------------------------------------------
    //      HELPERS
    //------------------------------------------

    //Returns the text for a card div, ready to be appended somewhere
    // All card divs contain their value in the id, e.g. 'hearts07'
    getCardDiv = function (cardId) {
        return '<div class="card" id="' + cardId + '"/>';
    }
    getCardHole = function () {
        return '<div class="emptyCard"/>';
    }

    //Converts a 1 digit number to 2 digit form with a leading 0, and leaves
    // a 2 digit number as it is. Untested with other sized numbers.
    convert = function (num) {
        return num.toString().replace(/^(\d{1})(?!\d)/, '0$1');
    }

    //Returns a properly formatted card Id based on number and suit
    // Number should be 1-13 and suit should be all lower-case and plural
    // e.g.: getCardId(1, "hearts) for ace of hearts
    getCardId = function (number, suit, additional) {
        return "" + suit + convert(number) + "-" + additional;
    }
    //Opposites
    getCardNumber = function (fullCardId) {
        var cardId = getImageId(fullCardId);
        return parseInt(cardId.substring(cardId.length - 2, cardId.length), 10);
    }
    getCardSuit = function (fullCardId) {
        var cardId = getImageId(fullCardId);
        return cardId.substring(0, cardId.length - 2);
    }
    //Returns just the basic part of the card Id used in image names
    getImageId = function (cardId) {
        return cardId.split("-")[0];
    }
    //Returns any content in the additional part of the card Id
    getAdditional = function (cardId) {
        return cardId.split("-", 2)[1];
    }
    //Gets the contianing boardrow element based on the cardBar id
    getCardBarContainerId = function (cardBarId) {
        switch (cardBarId) {
            case "table":
                return "top";
            case "hand":
                return "ThisPlayer";
            case "kHandCards":
                return "kHand";
            case "kTableCards":
                return "kTable";
            case "kPlayerCards":
                return "kPlayer";
            default:
                return cardBarId.replace("Hand", "");
        }
    }

    //Tells whether a card is a point card or a normal card
    isPointCard = function (cardId) {
        switch (getCardNumber(cardId)) {
            case 13:
            case 12:
            case 6:
                return true;
            case 11:
                var cardSuit = getCardSuit(cardId);
                if (cardSuit == "clubs" || cardSuit == "spades") {
                    return true;
                }
                break;
            case 7:
            case 4:
                if (getCardSuit(cardId) == "hearts") {
                    return true;
                }
                break;
            default:
                break;
        }
        return false;
    }

    //Loads up the appropriate card image to the card element with the specified id
    // Card id's should match the image names.
    addCardGraphic = function (id, isFront) {
        imagePath = '"../../Content/Images/Back.png"';
        if (isFront) {
            imagePath = '"../../Content/Images/deckfronts/' + getImageId(id) + '.png"';
        }
        $('#' + id).css("background-image", 'url(' + imagePath + ')');
        setSize('#' + id, cardwidths[size], cardheights[size]);
        $('#' + id).css("background-size", "" + cardwidths[size] + "px " + cardheights[size] + "px");
    }
    removeCardGraphic = function (id) {
        $('#' + id).css("background-image", "");
    }

    //Helpers for getting coordinates relative to element mouse event occured on, in same
    // coordinate space as the sub-elements' (cards') left and top positions
    relX = function (event, element) {
        return event.clientX - element.position().left - pagemargins[size] + $('.gameboard').scrollLeft();
    }
    relY = function (event, element, offset) {
        return event.clientY - element.position().top - pagemargins[size] - offset;
    }

    //Shortcut for getting elements by id
    e = function (id) {
        return $('#' + id);
    }

    //Formats a list of winning player names into a single string describing the winner(s)
    formatList = function (strings) {
        if (strings.length == 1) {
            return strings[0] + " won.";
        } else {
            var lastTwo = strings.slice(-2);
            var output = lastTwo[0] + " and " + lastTwo[1] + " tied.";
            for (var i = 0; i < strings.length - 2; i++) {
                output = strings[i] + ", " + output;
            }
            return output;
        }
    }

    //------------------------------------------
    //      GAME ENGINE
    //------------------------------------------

    //-----GLOBAL BEHAVIOR PARAMETERS-----

    dragMinimum = 5; //Minimum number of pixels mouse must move while down to be a drag

    //-----GLOBAL GRAPHICS PARAMETERS-----
    //All sizes based off of card widths: set freely (any number). Graphic max size is 180. Recommended min is 50.
    cardwidths = [50, 60, 72, 87, 104, 125, 150, 180];
    scrollwidth = 14;
    //Other sizing arrays are calculated
    cardwidthmins = [];     //Minimum card width (just side number/suit)
    cardheights = [];       //Height of card
    deckmargins = [];       //Extra space alloted for showing deck stack height
    deckwidths = [];        //Width of fully-stacked deck
    deckheights = [];       //Height of fully-stacked deck
    standardmargins = [];   //Default margin used between all elements
    cardmargins = [];       //Margin between cards on space-abundant cardBar
    handmins = [];          //Smallest size of a hand (2 full cards & 2 min-width cards)
    handmaxs = [];          //Largest size of a hand (4 full cards & 3 card margins)
    rowmargins = [];        //Margin between rows (top, each player)
    calcedHandWidth = 0;    //Actual size alloted to hands (calced based on screen width and size)
    calcedKBarWidth = 0;    //Actual size alloted to kings overlay card bars
    buttonWidthMaxs = [];   //Maximum width of action buttons
    buttonWidth = 0;        //Actual calculated button width (may be less when many actions are enabled)
    kButtonWidth = 0;       //Actual calculated king overlay button width
    buttonheights = [];     //Height of action buttons
    pagemargins = [];       //Margin on page outer border
    widthbreakpoints = [];  //Width minimums for each size
    heightbreakpoints = []; //Height minimums for each size
    xsmlTextSizes = [];     //Sizing for text elements
    smallTextSizes = [];
    medTextSizes = [];
    bigTextSizes = [];
    for (var i = 0; i < cardwidths.length; i++) {
        cardwidthmins[i] = 0.15 * cardwidths[i];
        cardheights[i] = 1.4 * cardwidths[i];
        deckmargins[i] = 0.2 * cardwidths[i];
        deckwidths[i] = cardwidths[i] + deckmargins[i];
        deckheights[i] = cardheights[i] + deckmargins[i];
        standardmargins[i] = 0.14 * cardwidths[i];
        cardmargins[i] = 0.07 * cardwidths[i];
        handmins[i] = 2 * cardwidths[i] + 2 * cardwidthmins[i];
        handmaxs[i] = 4 * cardwidths[i] + 3 * cardmargins[i];
        rowmargins[i] = 0.08 * cardwidths[i];
        buttonWidthMaxs[i] = 1.2 * cardheights[i];
        buttonheights[i] = 0.8 * cardwidths[i];
        pagemargins[i] = Math.min(10, 0.12 * cardwidths[i]);
        widthbreakpoints[i] = 2 * deckwidths[i] + handmins[i] + 0.5 * cardwidths[i] + 3 * standardmargins[i];
        heightbreakpoints[i] = 3 * deckheights[i] + buttonheights[i] + 3 * standardmargins[i];
        smallTextSizes[i] = cardwidths[i] / 60;
        xsmlTextSizes[i] = smallTextSizes[i] * 0.75;
        medTextSizes[i] = smallTextSizes[i] * 1.5;
        bigTextSizes[i] = smallTextSizes[i] * 3;
    }
    //Variables
    width = 0; //Total screen dimensions, set on window sizing events
    height = 0;
    oWidth = 0; //Dimensions of overlay content frame
    oHeight = 0;
    size = 0; //Index into sizing arrays, calculated on window sizing events using breakpoints
    firstSizeEvent = true; //Used to tell when a sizing event is the first one, triggering showing the page afterward
    gameOverNotShown = true; //Used to tell when the game over listings have already happened, so they aren't appended again with a new player game state event

    //-----SIZING EVENT-----------
    resize = function (wid, hei) {

        //---WINDOWS, SCREENS AND BUTTONS

        //Set size of window
        width = wid - 2 * pagemargins[size] - 1;
        height = hei - 2 * pagemargins[size] - 1;
        oWidth = wid * 0.7;
        oHeight = hei * 0.8;
        setSize('.overlay', wid - 1, hei - 1);
        setSize('.overlay .overlayContent', oWidth, oHeight);
        setPosition('.overlay .overlayContent', (wid - oWidth) / 2, (hei - oHeight) / 2);
        //Quenn/JOC buttons
        $('.queenButtons').css("width", oWidth);
        $('.queenButton').css("width", oWidth * 0.7);
        $('.qbSidePad').css("width", oWidth * 0.13);
        //Game over readout
        setSize('.gameOver', width, height / 6);
        $('.gameOver').css("top", height / 3);
        setSize('.winner', width, height / 2);
        $('.winner').css("top", height / 2);
        $('.goReadout, .goReadout span, .goReadoutData').css("width", width / 5);
        //$('.goReadout span').css("width", width / 5);
        $('.goCol1H, .goCol1').css("left", width / 10);
        $('.goCol2H, .goCol2').css("left", 3*width / 10);
        $('.goCol3H, .goCol3').css("left", 5*width / 10);
        $('.goCol4H, .goCol4').css("left", 7 * width / 10);
        var goLabelHeight = e('goNrml').height();
        var goRowHeight = $('#goName span').height();
        e('goName').css("height", goLabelHeight);
        e('goPnts').css("height", goLabelHeight);
        e('goScre').css("height", goLabelHeight);

        setSize('.gameboard', width, height);
        $('.gameboard').css("padding", pagemargins[size]);

        //---SIZING INDEX
        for (var i = 0; i < cardwidths.length; i++) {
            if (width < widthbreakpoints[i] || height < heightbreakpoints[i]) {
                break;
            }
            size = i;
        }

        //---SIZE-INDEX-DEPENDENT GAME ELEMENTS

        //Set text size
        $('.xsmlText').css("font-size", xsmlTextSizes[size] + "em");
        $('.smallText').css("font-size", smallTextSizes[size] + "em");
        $('.medText').css("font-size", medTextSizes[size] + "em");
        $('.bigText').css("font-size", bigTextSizes[size] + "em");
        $('.goRowH').css("height", goLabelHeight + standardmargins[size]);
        $('.goRow').css("height", goRowHeight + standardmargins[size]);
        //Set element sizes
        setSize('.card', cardwidths[size], cardheights[size]);
        setSize('.emptyCard', cardwidths[size], cardheights[size]);
        setPosition('.emptyCard', deckmargins[size], deckmargins[size]);
        $('.card').css("background-size", "" + cardwidths[size] + "px " + cardheights[size] + "px");
        setSize('.deck', deckwidths[size], deckheights[size]);
        $('.cardBar').css("top", deckmargins[size] + rowmargins[size]);
        $('.cardBar').css("height", cardheights[size]);
        $('.boardrow').css("height", deckheights[size]);
        $('.boardrow').css("padding", rowmargins[size]);
        //Set element positions
        var xcursor = rowmargins[size] + deckwidths[size] + standardmargins[size]; //After 1 deck
        e('table').css("left", xcursor);
        $('.pointCardPile').css("left", xcursor);
        xcursor += deckwidths[size] + standardmargins[size]; //After 1 more deck
        $('.hand').css("left", xcursor);
        setPosition('.playerLabel', xcursor + 2 * standardmargins[size], cardheights[size] / 2);
        //Calculating hand width (Total width minus 2 decks & 1/2 a card for the first king)
        calcedHandWidth = Math.max(handmins[size], Math.min(handmaxs[size], width - xcursor - standardmargins[size] - 0.5 * cardwidths[size]));
        $('.hand').css("width", calcedHandWidth);
        e('table').css("width", calcedHandWidth + cardwidths[size] + cardmargins[size]);
        calculateKingAndPlayerWidths();
        //Calculating king card bar width (Overlay width minus button)
        kButtonWidth = oWidth * 0.25 - scrollwidth;
        calcedKBarWidth = oWidth - kButtonWidth - standardmargins[size] - scrollwidth;
        setSize('.kButton', kButtonWidth, buttonheights[size]);
        setSize('.pButton', kButtonWidth, buttonheights[size]);
        setPosition('.kButton', calcedKBarWidth + standardmargins[size], (deckheights[size] - buttonheights[size]) / 2);
        $('.kCardBar').css("width", calcedKBarWidth);
        $('.kPlayerChooser').css("width", kButtonWidth);
        $('#kPlayerMenu').css("left", calcedKBarWidth + standardmargins[size] - 10);

        drawables.forEach(function (drawable, index) {
            drawable.redraw();
        });

        //Action buttons - at end so that we can grab scrollwidth after all the gameboard elements have their positions set
        var abuttonHeight = buttonheights[size] + 2 * standardmargins[size];
        setSize('.actionButtons', width, abuttonHeight);
        $('.actionButtons').css("left", pagemargins[size]);
        $('#buttonSpace').css("height", abuttonHeight);
        calculateButtonWidth();
        $('.actionButton').css("height", buttonheights[size]);
        $('.actionButton').css("margin", standardmargins[size] + "px");
        //Text readout
        setSize('.textReadout', width - 2 * pagemargins[size], abuttonHeight);
        $('.textReadout').css("bottom", abuttonHeight);
        $('.textReadout').css("left", pagemargins[size]);

        //Player menu positions
        if (e('josPlayerMenu').css("display") != "none") {
            setPosition('#josPlayerMenu', e('Use').offset().left, e('Use').offset().top - $('#josPlayerMenu').height() - 10);
        }
        if ($('#kPlayerMenu').css("display") != "none") {
            $('#kPlayerMenu').css("top", (deckheights[size] - buttonheights[size]) / 2 - $('#kPlayerMenu').height() - 10);
        }

        //Show page after first resize
        if (firstSizeEvent) {
            $(".SJBody").show();
            firstSizeEvent = false;
        }
    }
    calculateKingAndPlayerWidths = function () {
        $('.king').css("top", deckmargins[size] + rowmargins[size]);
        var amalgKings = [kings];
        for (var i = 0; i < otherPlayers.length; i++) {
            amalgKings.push(otherPlayers[i].kings);
        }
        for (var i = 0; i < amalgKings.length; i++) {
            var xcursor = rowmargins[size] + 2 * deckwidths[size] + 3 * standardmargins[size] + calcedHandWidth;
            for (var j = 0; j < amalgKings[i].kings.length; j++) {
                e(amalgKings[i].kings[j].id).css("left", xcursor);
                xcursor += cardwidths[size] + cardwidthmins[size] * amalgKings[i].kings[j].cardList.length + standardmargins[size];
            }
        }
    }

    //----ACTION BUTTON MANAGEMENT----

    enableAction = function (action) {
        e(action).show();
        calculateButtonWidth();
    }
    disableAction = function (action) {
        e(action).hide();
        calculateButtonWidth();
    }
    isActionEnabled = function (action) {
        var displaystatus = "displayed";
        e(action).attr("style").split(';').forEach(function (property, index) {
            if (property.indexOf("display") != -1) {
                displaystatus = property;
            }
        });
        return (displaystatus.indexOf("none") == -1);
    }
    clearActions = function () {
        var actions = $('.actionButtons button');
        for (var i = 0; i < actions.length; i++) {
            disableAction(actions[i].id);
        }
    }
    calculateButtonWidth = function () {
        var enabledActionCount = 0;
        ["Take", "Use", "Discard", "Kings", "UseforKing", "EndTurn"].forEach(function (action, index) {
            if (isActionEnabled(action)) {
                enabledActionCount += 1;
            }
        });
        buttonWidth = Math.min((width - 20) / enabledActionCount - 2 * standardmargins[size], buttonWidthMaxs[size]);
        $('.actionButton').css("width", buttonWidth);
    }

    //--------TURN----------

    updateTurn = function () {
        if (whosTurn == playerName) {
            updateActions();
            if (checkForDone()) {
                hub.server.imDone(roomCode, playerName);
            } else {
                $('.notYourTurn').hide();
                $('.actionButtons').show();
            }
        } else {
            $('.notYourTurn').show();
            $('.actionButtons').hide();
            $('.cardSelected').removeClass('cardSelected');
        }
    }

    hub.client.gameOver = function (gameResultsJson) {
        showGameOver(JSON.parse(gameResultsJson));
    }
    showGameOver = function (gameResults) {
        if (gameOverNotShown) {
            clearActions();
            //Generate lines in game over readout
            for (var i = 0; i < gameResults.PlayerNames.length; i++) {
                $('.winner').append('<div id="' + gameResults.PlayerNames[i] + 'readout" class="goRow">' +
                    '<span class="smallText goReadoutData goCol1">' + gameResults.PlayerNames[i] + '</span>' +
                    '<span class="smallText goReadoutData goCol2">' + gameResults.NormalCardCounts[i] + '</span>' +
                    '<span class="smallText goReadoutData goCol3">' + gameResults.PointCardCounts[i] + '</span>' +
                    '<span class="smallText goReadoutData goCol4">' + gameResults.Scores[i] + '</span>' +
                    '</div>');
            }
            $('.playerLabel').hide();
            $('.gameOver').show();
            $('.winnerHeadline').text(formatList(gameResults.Winners));
            $('.winner').show();
            resize(window.innerWidth, window.innerHeight);

            gameOverNotShown = false;
        }
    }

    //---------CLASSES------------

    //Class for the main draw deck, as well as point card and normal card piles
    function Deck(id) {
        this.id = id;
        this.cardList = [];

        this.pushCard = function (cardId) {
            if (this.cardList.length > 0) {
                removeCardGraphic(this.cardList[this.cardList.length - 1]);
            } else {
                this._clear();
            }
            var idToUse = (cardId == null ? "deckfill" + this.id + this.cardList.length : cardId);
            e(this.id).append(getCardDiv(idToUse));
            addCardGraphic(idToUse, cardId != null);
            this.cardList.push(idToUse);

            this.redraw();
        }

        this.popCard = function () {
            if (this.cardList.length > 0) {
                poppedId = this.cardList.pop();
                $('#' + poppedId).remove();
                if (this.cardList.length > 0) {
                    var idOfNewTop = this.cardList[this.cardList.length - 1];
                    var isFront = (idOfNewTop.substring(0, 8) != "deckfill");
                    addCardGraphic(idOfNewTop, isFront);
                } else {
                    e(this.id).append(getCardHole());
                    setSize('.emptyCard', cardwidths[size], cardheights[size]);
                    setPosition('.emptyCard', deckmargins[size], deckmargins[size]);
                }
                this.redraw();
            }
        }

        this.import = function (count, topCardId) {
            this._import(count, topCardId);
            this.redraw();
        }

        this._import = function (count, topCardId) {
            var oldLength = this.cardList.length;
            if (oldLength > 0) {
                removeCardGraphic(this.cardList[oldLength - 1]);
            } else {
                this._clear();
            }
            for (var i = 0; i < count - 1; i++) {
                var idToUse = "deckfill" + this.id + oldLength + i;
                e(this.id).append(getCardDiv(idToUse));
                this.cardList.push(idToUse);
            }
            if (count > 0) {
                var idToUse = (topCardId == null ? "deckfill" + this.id + this.cardList.length : topCardId);
                e(this.id).append(getCardDiv(idToUse));
                addCardGraphic(idToUse, topCardId != null);
                this.cardList.push(idToUse);
            }
        }

        this.clear = function () {
            this._clear();
            this.redraw();
        }

        this._clear = function () {
            this.cardList = [];
            e(this.id).empty();
            e(this.id).append('<div id="' + this.id + 'count" class="deckCount xsmlText"></div>');
            e(this.id).append(getCardHole());
        }

        this.clearAndImport = function(count, topCardId) {
            this._clear();
            this._import(count, topCardId);
            this.redraw();
        }

        this.redraw = function () {
            if (this.cardList.length > 0) {
                for (var i = 0; i < this.cardList.length; i++) {
                    setPosition('#' + this.cardList[i], Math.max(deckmargins[size] * (1 - i / (52 * numberOfDecks)), 0), Math.max(deckmargins[size] * (1 - i / (52 * numberOfDecks)), 0));
                }
            }
            setPosition('#' + this.id + "count", deckmargins[size], deckheights[size]);
            $('#' + this.id + 'count').css("width", cardwidths[size]);
            this.updateCount();
        }

        this.updateCount = function () {
            if (this.cardList.length > 0) {
                $('#' + this.id + 'count').text(this.cardList.length);
            } else {
                $('#' + this.id + 'count').text("");
            }
        }

        e(this.id).on('mouseup', (function (event) {
            //Click on deck -- for jack of spades
            // May be replaced with overlay
        }).bind(this));

        //Final clear after obejct loaded
        this._clear();
    }

    //Class for the table, hands, and card lists in King overlay
    function CardBar(id, isActive) {
        // General fields
        this.id = id;
        this.isActive = isActive; //Interactable (e.g. your hand) or not
        this.cardList = [];
        // Mouse interaction fields
        this.pos = 0; //Scroll position
        this.downat = -1; //Click start coordinate
        this.downpos = -1; //Click start position
        this.dragged = false;
        this.offsetElement = null; //id for first ancestor that is absolute with a relative parent. If not set, it's just this.id.
                                //Also, if this is set, selections won't trigger updateActions() (since it's not a gameboard cardBar)
        // Display fields
        this.width = 0; //Width of element, set by HTML
        this.baseWidth = 0; //Baseline width per card, calculated each redraw
        //this.listener = null; //Another 

        //-----General methods-----
        // Adds card to end of list
        this.pushCard = function (cardId) {
            //Creates card div in DOM
            e(this.id).append(getCardDiv(cardId));
            //Gives it proper image file
            addCardGraphic(cardId, this.isActive);
            //Adds id to list
            this.cardList.push(cardId);

            this.redraw();
        }
        // Adds a generic (non-facing) card to end of list
        this.pushBlankCard = function () {
            var cardId = this.id + "c" + this.cardList.length;
            this.pushCard(cardId);
        }
        // Removes specific card from list
        this.removeCard = function (cardId) {
            //Removes card element from DOM
            $('#' + this.id + " #" + cardId).remove();
            //Removes id from list
            index = this.cardList.indexOf(cardId);
            this.cardList.splice(index, 1);
            //Readjusts scroll position if necessary
            this.pos = Math.min(this.cardList.length - 2, this.pos);

            this.redraw();
        }
        //Returns whether this card bar has the given card, matching suit and number only (ignores additional)
        this.hasCard = function (cardId) {
            var cardIdMatch = getCardId(getCardNumber(cardId), getCardSuit(cardId), "");
            for(var i = 0; i < this.cardList.length; i++) {
                if (cardIdMatch == getCardId(getCardNumber(this.cardList[i]), getCardSuit(this.cardList[i]), "")) {
                    return true;
                }
            }
            return false;
        }
        // Finds a card with matching ID components, not minding additional additional info
        this.findPartialMatchID = function (partialId) {
            for (var i = 0; i < this.cardList.length; i++) {
                if (getCardSuit(partialId) == getCardSuit(this.cardList[i])) {
                    if (getCardNumber(partialId) == getCardNumber(this.cardList[i])) {
                        if (getAdditional(partialId).split('-')[0] == getAdditional(this.cardList[i]).split('-')[0]) {
                            return this.cardList[i];
                        }
                    }
                }
            }
            return null;
        }
        // Removes whatever the top card is
        this.popCard = function () {
            if (this.cardList.length > 0) {
                this.removeCard(this.cardList[this.cardList.length - 1]);
            }
        }
        // Selects/unselects specific card
        this.toggleSelectCard = function (cardId) {
            cardE = e(cardId);
            if (cardE.hasClass("cardSelected")) {
                cardE.removeClass("cardSelected");
            } else {
                cardE.addClass("cardSelected");
            }
            if (this.offsetElement == null) {
                updateActions();
            }
        }
        // Returns list of selected cards
        this.getSelected = function (noneIsAll) {
            var result = [];
            this.cardList.forEach(function (cardID, index) {
                if (e(cardID).hasClass("cardSelected")) {
                    result.push(cardID);
                }
            });
            if (noneIsAll && result.length == 0) {
                return this.cardList;
            }
            return result;
        }
        // Adds group of cards to list
        this.import = function (cards) {
            this._import(cards);
            this.redraw();
        }
        this._import = function (cards) {
            for (var i = 0; i < cards.length; i++) {
                //Creates card div in DOM
                e(this.id).append(getCardDiv(cards[i]));
                //Gives it proper image file
                addCardGraphic(cards[i], this.isActive);
                //Adds id to list
                this.cardList.push(cards[i]);
            }
        }
        // Clears all cards from the table
        this.clear = function () {
            this._clear();
            this.redraw();
        }
        this._clear = function () {
            e(this.id).empty();
            this.cardList = [];
        }
        this.clearAndImport = function (cards) {
            this._clear();
            this._import(cards);
            this.redraw();
        }
        
        //-----Graphics methods-----
        this.redraw = function () {
            barE = e(this.id);

            //Set to element width
            this.width = barE.width();

            //Move first card to 0
            e(this.cardList[0]).css('left', 0);
            //Position all cards
            switch (this.cardList.length) {
                case 0:
                case 1:
                    return;
                case 2:
                    e(this.cardList[1]).css('left', Math.min(this.width - cardwidths[size], cardwidths[size] + cardmargins[size]));
                    return;
                default:
                    //If not active, or if there's more than enough room for all the cards, they are simply
                    // arrayed out. In the former case, if there's not enough room, they will be layed out
                    // with equal spacing.
                    if (!this.isActive || this.width > this.cardList.length * cardwidths[size]) {
                        for (var i = 1; i < this.cardList.length; i++) {
                            e(this.cardList[i]).css('left', Math.min((this.width - cardwidths[size])*i / (this.cardList.length - 1), (cardwidths[size] + cardmargins[size])*i));
                        }
                    }
                    //If active without enough room for all cards, the baseline width per card is calculated
                        // and they are each assigned that much space. The position value is used to determine which
                        // card or two cards to give a little more space, so that you can scroll through the cards
                    else {
                        //The baseline width is the total width minus 2 full-width cards divided equally amongst the rest
                        this.baseWidth = (this.width - 2 * cardwidths[size]) / (this.cardList.length - 2);
                        for (var i = 1; i < this.cardList.length; i++) {
                            x = 0;
                            if (this.pos <= i - 1) { //Current card is after scroll position
                                x = (i - 1) * this.baseWidth + cardwidths[size];
                            } else {
                                if (this.pos >= i) { //Current card is before scroll position
                                    x = i * this.baseWidth;
                                } else { //Current card is the one moving with scroll
                                    x = i * this.baseWidth + (1 - this.pos % 1) * (cardwidths[size] - this.baseWidth);
                                }
                            }
                            e(this.cardList[i]).css('left', x);
                        }
                    }
            }
        }

        //-----Mouse methods-----
        this.changePos = function (newPos) {
            this.pos = newPos;
            this.redraw();
        }

        e(this.id).on('mousedown', (function (event) {
            //Starts a mouse operation, storing click info
            this.downat = relX(event, e(this.id));
            this.downpos = this.pos;
            this.dragged = false;
        }).bind(this));
        e(this.id).on('mousemove', (function (event) {
            //If the mouse is down, detects drag and scrolls
            if (this.downat >= 0) {
                dragDistance = this.downat - relX(event, e(this.id));
                if (Math.abs(dragDistance) > dragMinimum) {
                    this.changePos(Math.min(Math.max(dragDistance / (cardwidths[size] - this.baseWidth) + this.downpos, 0), this.cardList.length - 2));
                    this.dragged = true;
                }
            }
        }).bind(this));
        e(this.id).on('mouseup mouseleave', (function (event) {
            //Stops mouse operation. For drags, that's the end of the story
            this.downat = -1;
            this.downpos = -1;
            if (whosTurn != playerName) return; //Can't select cards if it's not your turn
            //Detects a click (on active card bars) and performs selection
            if (event.type == "mouseup" && !this.dragged && this.isActive) {
                clickx = relX(event, e(this.offsetElement == null ? this.id : this.offsetElement));
                clicky = relY(event, e(getCardBarContainerId(this.id)), this.offsetElement == null ? 0 : e(this.offsetElement).position().top);
                for (var i = this.cardList.length - 1; i >= 0; i--) {
                    cardx = e(this.cardList[i]).position().left;
                    if (clickx >= cardx && clickx < cardx + cardwidths[size]) {
                        var isSelected = e(this.cardList[i]).hasClass("cardSelected");
                        if (clicky < deckmargins[size] && !isSelected) {
                            continue; //Clicked above a non-selected card
                        }
                        if (clicky > cardheights[size] && isSelected) {
                            continue; //Clicked below a selected card
                        }
                        this.toggleSelectCard(this.cardList[i]);
                        return;
                    }
                }
            }
        }).bind(this));
    }

    //Class for Kings
    function King(id) {
        this.id = id;
        this.cardList = [];

        this.pushCard = function (cardId) {
            e(this.id).append(getCardDiv(cardId));
            addCardGraphic(cardId, true);
            this.cardList.push(cardId);

            this.redraw();
        }

        this.getNeededCards = function () {
            if (this.cardList.length == 0) {
                return null;
            }
            var neededCards = [];
            switch (getCardSuit(this.cardList[0])) {
                case "hearts":
                    neededCards.push(1, 5, 9);
                    break;
                case "diamonds":
                    neededCards.push(2, 6, 10);
                    break;
                case "clubs":
                    neededCards.push(3, 7, 11);
                    break;
                case "spades":
                    neededCards.push(4, 8);
                    break;
                default:
                    console.log("Unrecognized suit: " + getCardSuit(this.cardList[0]));
            }
            for (var i = 1; i < this.cardList.length; i++) {
                var ind = neededCards.indexOf(getCardNumber(this.cardList[i]));
                if (ind != -1) {
                    neededCards.splice(ind, 1);
                }
            }
            return neededCards;
        }

        this.redraw = function () {
            for (var i = 1; i < this.cardList.length; i++) {
                setPosition('#' + this.cardList[i], cardwidthmins[size] * i, deckmargins[size] * i * 0.5);
            }
            e(this.id).width(cardwidths[size] + cardwidths[size] * (this.cardList.length - 1));
        }

        this.import = function (cards) {
            this._import(cards);
            this.redraw();
        }
        this._import = function (cards) {
            for (var i = 0; i < cards.length; i++) {
                var cardId = getCardId(cards[i].number, cards[i].suit, "");
                e(this.id).append(getCardDiv(cardId));
                addCardGraphic(cardId, true);
                this.cardList.push(cardId);
            }
        }

        this.clear = function () {
            this._clear();
            this.redraw();
        }
        this._clear = function () {
            e(this.id).empty();
        }

        this.clearAndImport = function (cards) {
            this._clear();
            this._import(cards);
            this.redraw();
        }
    }

    function Kings(id) {
        this.id = id;
        this.kings = [];

        this.pushKing = function (kingId) {
            //Make Id for king object & add element
            var eId = this.id + '-' + kingId;
            e(this.id).append('<span id="' + eId + '" class="king"></span>');
            //Create king object
            var newKing = new King(eId);
            newKing.pushCard(kingId);
            //Give new king object first card (the king)
            this.kings.push(newKing);

            this.redraw();
        }

        this.removeKingByIndex = function (index) {
            if (this.kings.length > index) {
                $('#' + this.id + " #" + this.kings[index].id).remove();
                this.kings.splice(index, 1);
            }
            this.redraw();
        }

        this.redraw = function () {
            this.kings.forEach(function (king, index) {
                king.redraw();
            });
            calculateKingAndPlayerWidths();
        }

        this.import = function (cardss) {
            this._import(cardss);
            this.redraw();
        }
        this._import = function (cardss) {
            for (var i = 0; i < cardss.length; i++) {
                var eId = this.id + '-' +  getCardId(cardss[i][0].number, cardss[i][0].suit, "");
                e(this.id).append('<span id="' + eId + '" class="king"></span>');
                var newKing = new King(eId);
                newKing._import(cardss[i]);
                this.kings.push(newKing);
            }
        }

        this.clear = function () {
            this._clear();
            this.redraw();
        }
        this._clear = function () {
            e(this.id).empty();
            this.kings = [];
        }

        this.clearAndImport = function (cardss) {
            this._clear();
            this._import(cardss);
            this.redraw();
        }
    }

    function OtherPlayer(name, pointCards, normalCards, hand, kings) {
        this.name = name;
        this.pointCardPile = pointCards;
        this.normalCardPile = normalCards;
        this.hand = hand;
        this.kings = kings;
    }

    function GameAction(action, hand, table, misc) {
        this.playerName = playerName;
        this.action = action;
        this.hand = hand;
        this.table = table;
        this.misc = misc;
    }

    function CardObj(cardId) {
    	this.number = getCardNumber(cardId);
    	this.suit = getCardSuit(cardId);
    	this.additional = getAdditional(cardId);
        //this.getId = function() {
        //	return getCardId(this.number, this.suit, this.additional);
        //}
    }

    //----------GAME---------------

    //Game state variables
    drawpile = new Deck("drawpile");
    table = new CardBar("table", true);
    whosTurn = "";
    deckCount = 52;
    numberOfDecks = 1;
    //Player variables
    pointCardPile = new Deck("pointCardPile");
    normalCardPile = new Deck("normalCardPile");
    hand = new CardBar("hand", true);
    kings = new Kings("ThisPlayerKings");
    otherPlayers = [];
    //Queen count down variables
    queenTimer = null;
    queenCount = 10;
    queenOK = false;
    playedQueensAndJacks = [];
    playerOKs = [];
    jocplayers = [];
    queenPause = false;
    queenJocPlayers = [];
    //King overlay objects
    kHand = new CardBar("kHandCards", true); //Needed cards
    kTable = new CardBar("kTableCards", true);
    kPlayer = new CardBar("kPlayerCards", true);
    kHand.offsetElement = "kingContent"; //For callibrating cardBar click calculations
    kTable.offsetElement = "kingContent";
    kPlayer.offsetElement = "kingContent";
    kSourceHand = []; //Card locations at start of turn (for ensuring the don't-be-a-dick rule, even
    kSourceTable = [];// when reloading page after disconnect [mirrored in database])
    kNeededHand = []; // Numbers needed for kings
    kNeededTable = []; // Numbers needed for kings that aren't in hand
    kOuterClick = false; // Flag used to detect clicks outside middle area of kings overlay
    askedfor = []; //Keeps track of cards asked for, by player (lost on disconnect; it's not crucial)

    // Links for redraw convenience
    drawables = [];
    drawables.push(drawpile);
    drawables.push(table);
    drawables.push(pointCardPile);
    drawables.push(normalCardPile);
    drawables.push(hand);
    drawables.push(kHand);
    drawables.push(kTable);
    drawables.push(kPlayer);

    //Complete update of the board from the database
    hub.client.receivePlayerGameState = function (pgsdata) {
        pgs = JSON.parse(pgsdata);

        deckCount = pgs.DeckCount;
        numberOfDecks = pgs.NumberOfDecks;

        //Drawpile
        drawpile.clearAndImport(pgs.DeckCount, null);

        //Table
        gameTable = [];
        for (var i = 0; i < pgs.Table.length; i++) {
            gameTable.push(getCardId(pgs.Table[i].number, pgs.Table[i].suit, pgs.Table[i].additional));
        }
        table.clearAndImport(gameTable);

        //This player
        pointCardPile.clearAndImport(pgs.PointCardCount, null);
        var normalTopCard = null;
        if (pgs.NormalCards.Count > 0) {
            normalTopCard = getCardId(pgs.NormalCards.Top.number, pgs.NormalCards.Top.suit, pgs.NormalCards.Top.additional);
        }
        normalCardPile.clearAndImport(pgs.NormalCards.Count, normalTopCard);
        gameHand = [];
        for (var i = 0; i < pgs.Hand.length; i++) {
            gameHand.push(getCardId(pgs.Hand[i].number, pgs.Hand[i].suit, pgs.Hand[i].additional));
        }
        hand.clearAndImport(gameHand);
        kings.clearAndImport(pgs.Kings);
        if (pgs.KSources.length > 0) {
            pgs.KSources[0].forEach(function (cardobj, index) {
                kSourceHand.push(getCardId(cardobj.number, cardobj.suit, cardobj.additional));
            });
            pgs.KSources[1].forEach(function (cardobj, index) {
                kSourceTable.push(getCardId(cardobj.number, cardobj.suit, cardobj.additional));
            });
            updateKingsOverlay();
        }

        //Turn
        whosTurn = pgs.WhosTurn;
        updateTurn();

        //Other players
        otherPlayers = [];
        askedfor = [];
        for (var i = 0; i < pgs.OtherPlayers.length; i++) {
            opName = pgs.OtherPlayers[i].PlayerName;
            op = null;
            askedfor.push([]);

            //Find/create other player
            if ($('#' + opName).length == 0) {
                e('players').append('<div id="' + opName + '" class="boardrow"></div>');
                e(opName).append('<span id="' + opName + 'NormalCardPile" class="deck"></span>');
                e(opName).append('<span id="' + opName + 'PointCardPile" class="deck pointCardPile"></span>');
                e(opName).append('<span id="' + opName + 'Hand" class="cardBar hand"></span>');
                e(opName).append('<span id="' + opName + 'Label" class="playerLabel medText">' + opName + '</span>');
                e(opName).append('<span id="' + opName + 'Kings" class="kings"></span>');
                op = new OtherPlayer(
                    opName,
                    new Deck(opName + "PointCardPile"),
                    new Deck(opName + "NormalCardPile"),
                    new CardBar(opName + "Hand", false),
                    new Kings(opName + "Kings")
                );
                otherPlayers.push(op);
                drawables.push(op.pointCardPile);
                drawables.push(op.normalCardPile);
                drawables.push(op.hand);
                //drawables.push(op.kings);
            } else {
                for (var j = 0; j < otherPlayers.length; j++) {
                    if (otherPlayers[j].name == opName) {
                        op = otherPlayers[j];
                        break;
                    }
                }
            }

            //Update info
            op.pointCardPile.clearAndImport(pgs.OtherPlayers[i].PointCardCount, null);
            var opNormalTopCard = null;
            if (pgs.OtherPlayers[i].NormalCards.Count > 0) {
                opNormalTopCard = getCardId(pgs.OtherPlayers[i].NormalCards.Top.number, pgs.OtherPlayers[i].NormalCards.Top.suit, pgs.OtherPlayers[i].NormalCards.Top.additional);
            }
            op.normalCardPile.clearAndImport(pgs.OtherPlayers[i].NormalCards.Count, opNormalTopCard);
            ophand = [];
            for (j = 0; j < pgs.OtherPlayers[i].HandCount; j++) {
                ophand.push(opName + "Handc" + j);
            }
            op.hand.clearAndImport(ophand);
            op.kings.clearAndImport(pgs.OtherPlayers[i].Kings);
        }

        //Generation of player buttons
        if (otherPlayers.length == 1) {
            $('#kPlayerDrop').text("Ask");
        } else {
            for (var i = 0; i < otherPlayers.length; i++) {
                $('#kPlayerMenu').append('<button id="' + otherPlayers[i].name + 'PlayerButton" class="pButton xsmlText">' + otherPlayers[i].name + '</button>');
                $('#josPlayerMenu').append('<button id="' + otherPlayers[i].name + 'JOSPlayerButton" class="pButton xsmlText">' + otherPlayers[i].name + '</button>');
            }
        }

        resize(window.innerWidth, window.innerHeight);

        if (pgs.GameOver != null) {
            showGameOver(pgs.GameOver);
        }
    }

    updateKingsOverlay = function () {
        //Populate kings overlay cardbars
        kHand.clear();
        kTable.clear();
        kPlayer.clear();
        if (kings.kings.length > 0) {
            var suits = ["hearts", "diamonds", "clubs", "spades"];
            var neededCards = [];
            for (var i = 0; i < kings.kings.length; i++) {
                kings.kings[i].getNeededCards().forEach(function (number, index) {
                    neededCards.push(number);
                });
            }
            var neededNumMatches = [];
            kNeededHand = neededCards.slice(0);
            kNeededTable = kNeededHand.slice(0);
            kSourceHand.forEach(function (cardId, index) {
                var number = getCardNumber(cardId);
                var suit = getCardSuit(cardId);
                if (number == 11 && suits.indexOf(suit) >= 2) {
                    return;
                }
                var ind = neededCards.indexOf(number);
                if (ind == -1) {
                    return;
                }
                //neededCards.splice(ind, 1);
                neededNumMatches.push(number);
                ind = (hand.cardList.indexOf(cardId));
                if (ind != -1) {
                    kHand.pushCard(getCardId(number, suit, getAdditional(cardId) + "_kHand"));
                }
                ind = kNeededTable.indexOf(number);
                if (ind != -1) {
                    kNeededTable.splice(ind, 1);
                }
            });
            neededNumMatches.forEach(function (num, index) {
                var ind = neededCards.indexOf(num);
                if (ind != -1) {
                    neededCards.splice(ind, 1);
                }
            });
            neededNumMatches = [];
            kSourceTable.forEach(function (cardId, index) {
                var number = getCardNumber(cardId);
                var suit = getCardSuit(cardId);
                if (number == 11 && suits.indexOf(suit) >= 2) {
                    return;
                }
                var ind = neededCards.indexOf(number);
                if (ind == -1) {
                    return;
                }
                //neededCards.splice(ind, 1);
                neededNumMatches.push(number);
                ind = (table.cardList.indexOf(cardId));
                if (ind != -1) {
                    kTable.pushCard(getCardId(number, suit, getAdditional(cardId) + "_kTable"));
                }
            });
            neededNumMatches.forEach(function (num, index) {
                var ind = neededCards.indexOf(num);
                if (ind != -1) {
                    neededCards.splice(ind, 1);
                }
            });
            neededCards.forEach(function (number, index) {
                var redsonly = (number == 11);
                kPlayer.pushCard(getCardId(number, suits[Math.floor(Math.random() * (redsonly?2:4))], "kPlayer-" + index));
            });
        }
        //Collapsing empty sections
        if (kHand.cardList.length == 0) {
            e("kHand").hide();
        } else {
            e("kHand").show();
        }
        if (kTable.cardList.length == 0) {
            e("kTable").hide();
        } else {
            e("kTable").show();
        }
        if (kPlayer.cardList.length == 0) {
            e("kPlayer").hide();
        } else {
            e("kPlayer").show();
        }
        updateKingsButtonText();
    }

    // Starts a queen count down from the beginning
    hub.client.qcd = function (useQga) {
        var qga = JSON.parse(useQga);
        startQueenCountDown(qga.playerName.split("&"), qga.hand, 15, false);
    }
    // ResQ - Queen count down resume; This is sent by other clients (bounced off server) when a reconnect occurs during
    // a queen count down. For players still connected and counting down, this simply resumes (and aligns count). For the
    // reconnecting player (who is not counting down), this starts the count down. If the reconnecting player is the one
    // who played the queen, incoming resQ events from other players updates the internal OK list
    hub.client.resQ = function (count, queenAndJacks, queenAndJackPlayers, nonOks) {
        if (playedQueensAndJacks.length == 0) { // This client is not counting, so it must be the reconnecting one
            if (queenAndJackPlayers[0] == playerName) {
                startQueenCountDown(queenAndJackPlayers, queenAndJacks, count, false);
            } else {
                if (nonOks[0] != "ok") {
                    startQueenCountDown(queenAndJackPlayers, queenAndJacks, count, nonOks.indexOf(playerName) == -1);
                }
            }
        } else { // Already counting down, so just resume
            queenCount = count;
            queenPause = false;
        }
        if (queenAndJackPlayers[0] == playerName) { // Update the OK list for the queen/last jack player
            if (nonOks[0] == "ok" && nonOks.length == 2) {
                okq(nonOks[1]);
            }
        }
    }
    // Starts a queen count down. The player who played the queen sets up the queen variables to keep track of who still
    // needs to OK the queen or not. The other players get buttons for OKing (or playing the Jack of clubs). All players
    // schedule the count down. When the count runs out, anyone who hasn't will automatically send an OK.
    startQueenCountDown = function (queenPlayers, queensAndJacks, timerCount, isOKd) {
        $('#jack').hide();
        $('#nojack').hide();
        queenJocPlayers = queenPlayers;
        jocplayers = [];
        if (queenPlayers[0] == playerName) {
            queenOK = true;
            playerOKs = [];
            otherPlayers.forEach(function (oPlayer, index) {
                playerOKs.push(oPlayer.name);
            });
        } else {
            queenOK = isOKd;
            playerOKs = [playerName];
            if (!queenOK) {
            	var jackCount = 0;
            	var usedJacks = 0;
            	queenJocPlayers.forEach(function (qjpName, index) {
            		if (index < queenJocPlayers.length - 1 && qjpName == playerName) {
            			usedJacks += 1;
            		}
            	});
                hand.cardList.forEach(function (cardId, index) {
                    if (getImageId(cardId) == "clubs11") {
						jackCount += 1;
                    }
                });
                if (jackCount > usedJacks) {
                    $('#jack').show();
                } else {
                    $('#nojack').show();
                }
            }
        }
        updateSweeperText();
        $('.queenOverlay').show();
        queenCount = timerCount;
        playedQueensAndJacks = queensAndJacks;
        queenPause = false;
        queenTimer = setInterval(function () {
            if (!queenPause) {
                $('#count').text(queenCount);
                if (queenCount <= 0) {
                    if (!queenOK) {
                        $('#jack').hide();
                        $('#nojack').hide();
                        hub.server.okQueen(roomCode, playerName);
                    }
                    clearInterval(queenTimer);
                } else {
                    queenCount -= 1;
                }
            }
        }, 1000000);
        //If hand has no cards, send OK automatically
        if (hand.cardList.length == 0) {
            clickOKQ();
        }
    }

    updateSweeperText = function () {
        var text = "";
        for (var i = queenJocPlayers.length - 1; i >= 0; i--) {
            text = text + "<br>" + (queenJocPlayers[i] == playerName ? "P" : queenJocPlayers[i] + " is p") + "laying a " + (i == queenJocPlayers.length - 1 ? "Queen" : "Jack of Clubs") + "...";
        }
    	//queenJocPlayers.forEach(function (player, index) {
    	//	text = text + "<br>" + (player == playerName ? "P" : player + " is p") + "laying a " + (index == 0 ? "Queen" : "Jack of Clubs") + "...";
    	//});
    	$('#sweeper').html(text);
    }

    // Method(s) for updating queen OK list, for the queen player only. Removes ok'd name from list. When list is empty,
    // triggers call to complete queen play.
    hub.client.okQueen = function (okingName) {
        okq(okingName);
    }
    okq = function (okingName) {
        var index = playerOKs.indexOf(okingName);
        playerOKs.splice(index, 1);
        if (playerOKs.length == 0) {
            tableCards = [];
            table.cardList.forEach(function (cardID, index) {
                tableCards.push(new CardObj(cardID));
            });
            var ga = new GameAction("endQ", playedQueensAndJacks, tableCards, null);
            ga.playerName = queenJocPlayers.join("&");
            hub.server.gameAction(roomCode, JSON.stringify(ga));
        }
    }
    // Action for clicking the OK button in a queen count down, from a non-queen-playing player
    clickOKQ = function () {
        queenOK = true;
        $('#nojack').hide();
        hub.server.okQueen(roomCode, playerName, queenJocPlayers[0]);
    }

    hub.client.receivePlayerGameAction = function(pgadata) {
        var pga = JSON.parse(pgadata);
        switch (pga.action) {
            case "take":
                var collectedCards = [];
                //Removing cards from table
                for (var i = 0; i < pga.table.length; i++) {
                    var cardId = getCardId(pga.table[i].number, pga.table[i].suit, pga.table[i].additional);
                    collectedCards.push(cardId);
                    table.removeCard(cardId);
                }
                //Removing cards from hand
                for (var i = 0; i < pga.hand.length; i++) {
                    var cardId = getCardId(pga.hand[i].number, pga.hand[i].suit, pga.hand[i].additional);
                    collectedCards.push(cardId);
                    if (pga.playerName == playerName) {
                        hand.removeCard(cardId);
                    } else {
                        for (var j = 0; j < otherPlayers.length; j++) {
                            if (otherPlayers[j].name == pga.playerName) {
                                otherPlayers[j].hand.popCard();
                            }
                        }
                    }
                }
                //Adding cards to card piles
                for (var i = 0; i < collectedCards.length; i++) {
                    if (pga.playerName == playerName) {
                        if(isPointCard(collectedCards[i])) {
                            pointCardPile.pushCard(null);
                        } else {
                            normalCardPile.pushCard(collectedCards[i]);
                        }
                    } else {
                        for (var j = 0; j < otherPlayers.length; j++) {
                            if (otherPlayers[j].name == pga.playerName) {
                                if (isPointCard(collectedCards[i])) {
                                    otherPlayers[j].pointCardPile.pushCard(null);
                                } else {
                                    otherPlayers[j].normalCardPile.pushCard(collectedCards[i]);
                                }
                            }
                        }
                    }
                }
                if (pga.playerName == playerName) {
                    updateKingsOverlay();
                    updateActions();
                }
                break;
            case "useK":
                pga.hand.forEach(function (cardobj, index) {
                    var kingID = getCardId(cardobj.number, cardobj.suit, cardobj.additional);
                    if (pga.playerName == playerName) {
                        //Removing king from hand
                        hand.removeCard(kingID);
                        //Playing king
                        kings.pushKing(kingID);
                    } else {
                        for (var i = 0; i < otherPlayers.length; i++) {
                            if (otherPlayers[i].name == pga.playerName) {
                                //Removing a card from hand
                                otherPlayers[i].hand.popCard();
                                //Playing king
                                otherPlayers[i].kings.pushKing(kingID);
                            }
                        }
                    }
                });
                if (pga.playerName == playerName) {
                    updateKingsOverlay();
                    updateAskEnablement();
                    updateActions();
                }
                break;
            case "u4K":
                //Remove used cards from game boards, kings overlay, and kSources
                if (pga.misc == "table") {
                    pga.hand.forEach(function (cardobj, index) {
                        var cardId = getCardId(cardobj.number, cardobj.suit, cardobj.additional);
                        table.removeCard(cardId);
                        var ksti = kSourceTable.indexOf(cardId);
                        if (ksti >= 0) {
                        	kSourceTable.splice(ksti, 1);
                        }
                    });
                } else {
                    if (pga.misc == playerName) {
                        pga.hand.forEach(function (cardobj, index) {
                            var cardId = getCardId(cardobj.number, cardobj.suit, cardobj.additional);
                            hand.removeCard(cardId);
                            var kshi = kSourceHand.indexOf(cardId);
                            if (kshi >= 0) {
                            	kSourceHand.splice(kshi, 1);
                            }
                        });
                    } else {
                        for (var i = 0; i < otherPlayers.length; i++) {
                            if (otherPlayers[i].name == pga.misc) {
                                //If this player is using another's cards for kings, the
                                // askedfor array is updated
                                if (pga.playerName == playerName) {
                                    updateAskedFor(pga.misc);
                                }
                                pga.hand.forEach(function (cardobj, index) {
                                    otherPlayers[i].hand.popCard();
                                });
                            }
                        }
                    }
                }
                //Sort cards by which kings they go to
                var sortedCards = [];
                var completedKings = [];
                var cardIds = [];
                pga.hand.forEach(function (cardobj, index) {
                    cardIds.push(getCardId(cardobj.number, cardobj.suit, cardobj.additional));
                });
                var playersKings = null;
                if (pga.playerName == playerName) {
                    playersKings = kings;
                } else {
                    otherPlayers.forEach(function (otherPlayer, index) {
                        if (otherPlayer.name == pga.playerName) {
                            playersKings = otherPlayer.kings;
                        }
                    });
                }
                playersKings.kings.forEach(function (king, index) {
                    sortedCards.push([]);
                    var neededNumbers = king.getNeededCards();
                    for (var i = cardIds.length - 1; i >= 0; i--) {
                        var ind = neededNumbers.indexOf(getCardNumber(cardIds[i]));
                        if (ind != -1) {
                            sortedCards[index].push(cardIds[i]);
                            neededNumbers.splice(ind, 1);
                            cardIds.splice(i, 1);
                        }
                    }
                    //Mark any completed kings
                    if (neededNumbers.length == 0) {
                        completedKings.push("complete");
                    } else {
                        completedKings.push("incomplete");
                    }
                });
                //Add cards to kings
                playersKings.kings.forEach(function (king, index) {
                    sortedCards[index].forEach(function (cardId, ind) {
                        king.pushCard(cardId);
                    });
                });
                //Remove completed kings and collect cards
                var collectedCards = [];
                for (var i = completedKings.length - 1; i >= 0; i--) {
                    if (completedKings[i] == "complete") {
                        playersKings.kings[i].cardList.forEach(function (cardId, index) {
                            collectedCards.push(cardId);
                        });
                        playersKings.removeKingByIndex(i);
                    }
                }
                for (var i = 0; i < collectedCards.length; i++) {
                    if (pga.playerName == playerName) {
                        if (isPointCard(collectedCards[i])) {
                            pointCardPile.pushCard(null);
                        } else {
                            normalCardPile.pushCard(collectedCards[i]);
                        }
                    } else {
                        for (var j = 0; j < otherPlayers.length; j++) {
                            if (otherPlayers[j].name == pga.playerName) {
                                if (isPointCard(collectedCards[i])) {
                                    otherPlayers[j].pointCardPile.pushCard(null);
                                } else {
                                    otherPlayers[j].normalCardPile.pushCard(collectedCards[i]);
                                }
                            }
                        }
                    }
                }
                //Update actions
                if (pga.playerName == playerName) {
                    updateKingsOverlay();
                    if ($('.kingOverlay').css("display") == "none") {
                        updateActions();
                    }
                }
                break;
        	case "endQ":
                //Stop count down
        		if (queenTimer != null) {
        			clearInterval(queenTimer);
        		}
        		playedQueensAndJacks = [];
        		$('.queenOverlay').hide();
                //Remove cards
                table.clear(); //from table
                var collectedCards = [];
                for (var i = 0; i < pga.table.length; i++) {
                    var cardId = getCardId(pga.table[i].number, pga.table[i].suit, pga.table[i].additional);
                    collectedCards.push(cardId);
                }
            	// remove queens and jacks
                var playerNames = pga.playerName.split("&");
                for (var i = 0; i < pga.hand.length; i++) {
                	if (playerNames[i] == playerName) {
                		hand.removeCard(getCardId(pga.hand[i].number, pga.hand[i].suit, pga.hand[i].additional));
                	} else {
                		for (var j = 0; j < otherPlayers.length; j++) {
                			if (otherPlayers[j].name == playerNames[i]) {
                				otherPlayers[j].hand.popCard();
                			}
                		}
                	}
                	collectedCards.push(getCardId(pga.hand[i].number, pga.hand[i].suit, pga.hand[i].additional));
                }
                //Adding cards to card piles
                for (var i = 0; i < collectedCards.length; i++) {
                    if (playerNames[0] == playerName) {
                        if (isPointCard(collectedCards[i])) {
                            pointCardPile.pushCard(null);
                        } else {
                            normalCardPile.pushCard(collectedCards[i]);
                        }
                    } else {
                        for (var j = 0; j < otherPlayers.length; j++) {
                        	if (otherPlayers[j].name == playerNames[0]) {
                                if (isPointCard(collectedCards[i])) {
                                    otherPlayers[j].pointCardPile.pushCard(null);
                                } else {
                                    otherPlayers[j].normalCardPile.pushCard(collectedCards[i]);
                                }
                            }
                        }
                    }
                }
                //Update actions
                if (playerNames[playerNames.length - 1] == playerName) {
                    updateKingsOverlay();
                    updateActions();
                }
                break;
            case "useJ":
                if (pga.playerName == playerName) {
                    hand.removeCard(getCardId(pga.hand[0].number, pga.hand[0].suit, pga.hand[0].additional));
                    pointCardPile.pushCard(null);
                } else {
                    for (var i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == pga.playerName) {
                            otherPlayers[i].hand.popCard();
                            otherPlayers[i].pointCardPile.pushCard(null);
                        }
                    }
                }
                if (pga.misc == playerName) {
                    pointCardPile.popCard();
                } else {
                    for (var i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == pga.misc) {
                            otherPlayers[i].pointCardPile.popCard();
                        }
                    }
                }
                if (pga.playerName == playerName) {
                    updateActions();
                }
                break;
            case "discard":
                //Removing discarded card from hand
                if (pga.hand != null) {
                    if (pga.playerName == playerName) {
                        hand.removeCard(getCardId(pga.hand[0].number, pga.hand[0].suit, pga.hand[0].additional));
                    } else {
                        for (var i = 0; i < otherPlayers.length; i++) {
                            if (otherPlayers[i].name == pga.playerName) {
                                otherPlayers[i].hand.popCard();
                            }
                        }
                    }
                }
                //Adding discarded card to Table
                if (pga.hand != null) {
                    table.pushCard(getCardId(pga.hand[0].number, pga.hand[0].suit, pga.hand[0].additional));
                }
                //Adding drawn cards/reducing drawpile
                if (pga.misc == playerName) {
                    for (var j = 0; j < pga.table.length; j++) {
                        hand.pushCard(getCardId(pga.table[j].number, pga.table[j].suit, pga.table[j].additional));
                        drawpile.popCard();
                    }
                    //Updating kSources
                    //kSourceHand = [];
                    kSourceHand = hand.cardList.slice(0);
                    kSourceTable = [];
                    //hand.cardList.forEach(function (cardId, index) {
                    //    kSourceHand.push(cardId);
                    //});
                    table.cardList.forEach(function (cardId, index) {
                        kSourceTable.push(cardId);
                    });
                    //Updating askedfor matrix
                    //askedfor = [];
                    //otherPlayers.forEach(function (a, b) {
                    //    askedfor.push([]);
                    //});
                    updateKingsOverlay();
                    updateAskEnablement();
                } else {
                    for (var i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == pga.misc) {
                            for (var j = 0; j < pga.table.length; j++) {
                                otherPlayers[i].hand.pushBlankCard();
                                drawpile.popCard();
                            }
                            if (pga.table.length > 0) {
                                console.log("Clearing af[] for " + otherPlayers[i].name);
                                askedfor[i] = [];
                            } else {
                                console.log("No cards drawn by " + otherPlayers[i].name);
                            }
                        }
                    }
                }
                //Updating Turn
                whosTurn = pga.misc;
                updateTurn();
                break;
            default:
                console.log("default - " + pga.action);
                break;
        }
    }

    //Examines card selection and figures out which actions are possible, then enables those actions
    updateActions = function () {
        clearActions();
        var selectedHand = hand.getSelected(true);
        var selectedTable = table.getSelected(true)
        var onlyNumbered = true;
        if (selectedHand.length == 1) {
            enableAction("Discard");
            var selNum = getCardNumber(selectedHand[0]);
            var selSuit = getCardSuit(selectedHand[0]);
            //Sweep, play King
            if (selNum == 12 || selNum == 13) {
                enableAction("Use");
                onlyNumbered = false;
            }
            //Use jack of spades
            if (selNum == 11 && selSuit == "spades") {
                for (var i = 0; i < otherPlayers.length; i++) {
                    if (otherPlayers[i].pointCardPile.cardList.length > 0) {
                        enableAction("Use");
                        break;
                    }
                }
            }
            //Pick up queen with wash
            if (selNum == 11 && selSuit == "clubs") {
                onlyNumbered = false;
                if (selectedTable.length == 1 && getCardNumber(selectedTable[0]) == 12) {
                    enableAction("Take");
                }
            }
        }
        //Check for non-numbered cards in multiple card selection
        if (onlyNumbered) {
            selectedHand.forEach(function (cardId, index) {
                var selNum = getCardNumber(cardId);
                if (selNum == 12 || selNum == 13) {
                    onlyNumbered = false;
                } else {
                    if (selNum == 11) {
                        var selSuit = getCardSuit(cardId);
                        if (selSuit == "spades" || selSuit == "clubs") {
                            onlyNumbered = false;
                        }
                    }
                }
            });
            selectedTable.forEach(function (cardId, index) {
                var selNum = getCardNumber(cardId);
                if (selNum == 12 || selNum == 13) {
                    onlyNumbered = false;
                } else {
                    if (selNum == 11) {
                        var selSuit = getCardSuit(cardId);
                        if (selSuit == "spades" || selSuit == "clubs") {
                            onlyNumbered = false;
                        }
                    }
                }
            });
        }
        //No cards in selection of hand or table are kings, queens, or black jacks
        if (onlyNumbered) {
            var total = 0;
            selectedHand.forEach(function (cardId, index) {
                total += getCardNumber(cardId);
            });
            selectedTable.forEach(function (cardId, index) {
                total -= getCardNumber(cardId);
            });
            if (total == 0) {
                if (hand.cardList.length != 0) {
                    enableAction("Take");
                }
            }
        } else { //Multiple cards selected that include non-numbered cards
            var allKings = true; // Check for case of all kings selected
            selectedHand.forEach(function (cardId, index) {
                if (getCardNumber(cardId) != 13) {
                    allKings = false;
                }
            });
            if (allKings) {
                if (hand.cardList.length != 0) {
                    enableAction("Use");
                }
            }
        }
        // Use for King
        var onlySelectedHand = hand.getSelected(false);
        var onlySelectedTable = table.getSelected(false);
        if (onlySelectedHand.length != 0 || onlySelectedTable.length != 0) {
            var canUseForKings = true;
            var neededNumbers = kNeededHand.slice(0);
            onlySelectedHand.forEach(function (cardId, index) {
                if (!kHand.hasCard(cardId)) {
                    canUseForKings = false;
                } else {
                    var ind = neededNumbers.indexOf(getCardNumber(cardId));
                    if (ind != -1) {
                        neededNumbers.splice(ind, 1);
                    } else {
                        canUseForKings = false;
                    }
                }
            });
            neededNumbers = kNeededTable.slice(0);
            onlySelectedTable.forEach(function (cardId, index) {
                if (!kTable.hasCard(cardId)) {
                    canUseForKings = false;
                } else {
                    var ind = neededNumbers.indexOf(getCardNumber(cardId));
                    if (ind != -1) {
                        neededNumbers.splice(ind, 1);
                    } else {
                        canUseForKings = false;
                    }
                }
            });
            if (canUseForKings) {
                enableAction("UseforKing");
            }
        }
        if (hand.cardList.length == 0) {
            enableAction("EndTurn");
        }
        if (kings.kings.length > 0) {
            enableAction("Kings");
        }
    }

    askFromPlayer = function (playerToAsk) {
        var askedForCards = [];
        var selectedCards = kPlayer.getSelected(true);
        selectedCards.forEach(function (cardId, index) {
            askedForCards.push(new CardObj(cardId)); //Note: suits/additional are random and will be ignored
        });
        var update = JSON.stringify(new GameAction("ask", askedForCards, null, playerToAsk));
        hub.server.gameAction(roomCode, update);
    }

    hub.client.nothingFrom = function (otherPlayerName) {
        updateAskedFor(otherPlayerName);
    }
    updateAskedFor = function(otherPlayerName) {
        var ind = -1;
        otherPlayers.forEach(function (oPlayer, index) {
            if (oPlayer.name == otherPlayerName) {
                ind = index;
            }
        });
        if (ind != -1) {
            kPlayer.getSelected(true).forEach(function (cardId, index) {
                if (askedfor[ind].indexOf(getCardNumber(cardId)) == -1) {
                    askedfor[ind].push(getCardNumber(cardId));
                    console.log("Adding " + getCardNumber(cardId) + " to askedfor for " + otherPlayers[ind].name);
                }
            });
            updateAskEnablement();
        }
    }
    updateAskEnablement = function () {
        var everyone = (otherPlayers.length > 1 ? true : null);
        otherPlayers.forEach(function (oPlayer, ind) {
            //Reevaluate grey state
            var stillSomeLeft = false;
            for (var i = 0; i < kPlayer.cardList.length; i++) {
                if (askedfor[ind].indexOf(getCardNumber(kPlayer.cardList[i])) == -1) {
                    if (oPlayer.hand.cardList.length > 0) {
                        stillSomeLeft = true;
                        break;
                    }
                }
            }
            if (stillSomeLeft) {
                if (otherPlayers.length == 1) {
                    e('kPlayerDrop').prop('disabled', false);
                } else {
                    e(oPlayer.name + "PlayerButton").prop('disabled', false);
                    everyone = false;
                }
            } else {
                if (otherPlayers.length == 1) {
                    e('kPlayerDrop').prop('disabled', true);
                } else {
                    e(oPlayer.name + "PlayerButton").prop('disabled', true);
                }
            }
        });
        if (otherPlayers.length > 1) {
            if (everyone) {
                e('kPlayerDrop').prop('disabled', true);
                e('kPlayerMenu').hide();
            } else {
                e('kPlayerDrop').prop('disabled', false);
            }
        }
        updateKingsButtonText();
    }

    updateKingsButtonText = function () {
        if(kHand.cardList.length == 0 && kTable.cardList.length == 0 && (
          e('kPlayerDrop').prop('disabled') || kPlayer.cardList.length == 0)) {
            e('Kings').text("Kings (done)");
            //checkForDone();
        } else {
            e('Kings').text("Kings");
        }
    }

    showKingOverlay = function () {
        if (isActionEnabled("Kings")) {
            history.pushState({ srn: "Game", rc: roomCode, sub: "king" }, "Game - " + roomCode, window.location);
            clearActions();
            $('.kingOverlay').show();
            return true;
        }
        return false;
    }
    hideKingOverlay = function () {
        if (!$('.kingOverlay')[0].hidden) {
            $('.kingOverlay').hide();
            e('kPlayerMenu').hide();
            updateActions();
            return true;
        }
        return false;
    }

    checkForDone = function () {
        return e('Kings').text() == "Kings (done)" && drawpile.cardList.length == 0 && hand.cardList.length == 0;
    }

    showText = function (text) {
        var readoutArray = e('textReadoutContents').html().split('<br>');
        readoutArray = readoutArray.concat(text).slice(Math.max(readoutArray.length - 3, 0));
        e('textReadoutContents').html(readoutArray.join('<br>'));
    }

    hub.client.showText = function (text) {
        showText(text);
    }

    //Methods for registering a click outside the king overlay. A click on any part of the overlay (inside or outside)
    // triggers one click event, and a click on only the inner part triggers the other. If the first happens but not
    // the second, then it's a click outside.
    kingOverlayOuterClick = function () {
        if (kOuterClick) {
            kOuterClick = false;
            if (history.state != null && history.state.sub == "king") {
                window.history.back();
            }
        }
    }
    kingOverlayInnerClick = function () {
        kOuterClick = false;
    }

    $(document).ready(function () {
        resize(window.innerWidth, window.innerHeight);

        $(window).resize(function () {
            resize(window.innerWidth, window.innerHeight);
        })
        
        //--------ACTIONS----------
        $('#Take').on('click', function () {
            clearActions();
            var handCards = [];
            hand.getSelected(true).forEach(function (cardId, index) {
                handCards.push(new CardObj(cardId));
            });
            var tableCards = [];
            table.getSelected(true).forEach(function (cardId, index) {
                tableCards.push(new CardObj(cardId));
            });
            var update = JSON.stringify(new GameAction("take", handCards, tableCards, null));
            hub.server.gameAction(roomCode, update);
        });
        $('#Use').on('click', function () {
            var clear = true;
            var usedCard = new CardObj(hand.getSelected(true)[0]);
            var update = null;
            switch (usedCard.number) {
                case 13:
                    var kingsToPlay = [];
                    hand.getSelected(true).forEach(function (cardId, index) {
                        kingsToPlay.push(new CardObj(cardId));
                    });
                    update = JSON.stringify(new GameAction("useK", kingsToPlay, null, null));
                    break;
                case 12:
                    var noCards = true;
                    otherPlayers.forEach(function (oPlayer, index) {
                        if (oPlayer.hand.cardList.length > 0) {
                            noCards = false;
                        }
                    });
                    if (noCards) { //No one else has any cards, so no need for the count down
                        tableCards = [];
                        table.cardList.forEach(function (cardID, index) {
                            tableCards.push(new CardObj(cardID));
                        });
                        update = JSON.stringify(new GameAction("endQ", [usedCard], tableCards, null));
                    } else { //Someone could have the JC, so countdown is started
                        update = JSON.stringify(new GameAction("useQ", [usedCard], null, null));
                    }
                    break;
                case 11:
                    //The logic for showing the Use action in the first place takes care of checking that this is the jack of spades
                    if (otherPlayers.length == 1) {
                        update = JSON.stringify(new GameAction("useJ", [usedCard], null, otherPlayers[0].name));
                    } else {
                        var otherPlayerWithPoint = null;
                        for (var i = 0; i < otherPlayers.length; i++) {
                            if (otherPlayers[i].pointCardPile.cardList.length > 0) {
                                if (otherPlayerWithPoint != null) { //Multiple other players with points
                                    otherPlayerWithPoint = null; //Set to null to indicate the need for the menu
                                    break;                          // and break.
                                }
                                otherPlayerWithPoint = otherPlayers[i].name;
                            }
                        }
                        if (otherPlayerWithPoint != null) { //Only one other player with point
                            update = JSON.stringify(new GameAction("useJ", [usedCard], null, otherPlayerWithPoint));
                            break;
                        }
                        //Choose player with menu
                        $('#josPlayerMenu button').show();
                        setPosition('#josPlayerMenu', e('Use').offset().left, e('Use').offset().top - $('#josPlayerMenu').height() - 10);
                        if (e('josPlayerMenu').css("display") == "none") {
                            e('josPlayerMenu').show();
                        } else {
                            e('josPlayerMenu').hide();
                        }
                        clear = false;
                    }
                    break;
                default:
                    console.log("Use " + usedCard.number + " of " + usedCard.suit);
                    break;
            }
            if (clear) {
                clearActions();
            }
            if (update != null) {
                hub.server.gameAction(roomCode, update);
            }
        });
        $('#OK').on('click', function () {
            clickOKQ();
        });
        $('#HoldJack').on('click', function () {
            queenOK = true;
            $('#jack').hide();
            hub.server.okQueen(roomCode, playerName, queenJocPlayers[0]);
        });
        $('#UseJack').on('click', function () {
        	$('#jack').hide();
        	var noCards = true;
        	if (numberOfDecks > 1) { // With only one deck, there's only one JoC, so we don't bother with the extra JoC count down. With 2 or more, players may not have kept track, so a count down is done.
        		otherPlayers.forEach(function (oPlayer, index) {
        			// Count up the number of cards in this player's hand accounted for by the Queen and JoC's this player has played
        			var playedQsAndJs = 0;
        			queenJocPlayers.forEach(function (qjocPlayerName, index) {
        				if (qjocPlayerName == oPlayer.name) {
        					playedQsAndJs += 1;
        				}
        			});
        			// Not including those, are there any cards left that could be more JoC's?
        			if (oPlayer.hand.cardList.length > playedQsAndJs) {
        				noCards = false;
        			}
        		});
        	}
        	queenJocPlayers.splice(0, 0, playerName);
        	// Need to use a JoC that isn't already played
        	var chosenJoC = null;
        	hand.cardList.forEach(function (cardId, index) {
        		if (getImageId(cardId) != "clubs11") {
        			return;
        		}
        		if (playedQueensAndJacks.find(function (cardobj) {
        			return getCardId(cardobj.number, cardobj.suit, cardobj.additional) == cardId;
        		}) != undefined) {
        			return;
        		}
        		chosenJoC = new CardObj(cardId);
        	});
        	playedQueensAndJacks.splice(0, 0, chosenJoC);
        	if (noCards) { // No cards left besides those played in this queen/jack exchange
        		var tableCards = [];
        		table.cardList.forEach(function (cardID, index) {
        			tableCards.push(new CardObj(cardID));
        		});
        		var ga = new GameAction("endQ", playedQueensAndJacks, tableCards, null);
        	} else { // Other cards left: start a new count down for more JoC's
        		var ga = new GameAction("useQ", playedQueensAndJacks, null, null);
        	}
        	ga.playerName = queenJocPlayers.join("&");
        	var update = JSON.stringify(ga);
        	hub.server.gameAction(roomCode, update);
        });
        $('#Discard').on('click', function () {
            clearActions();
            var update = JSON.stringify(new GameAction("discard", [new CardObj(hand.getSelected(true)[0])], null, null));
            hub.server.gameAction(roomCode, update);
        });
        $('#EndTurn').on('click', function () {
            clearActions();
            var update = JSON.stringify(new GameAction("discard", null, null, null));
            hub.server.gameAction(roomCode, update);
        });
        $('#UseforKing').on('click', function () {
            var onlySelectedHand = hand.getSelected(false);
            var handCards = [];
            onlySelectedHand.forEach(function (cardId, index) {
                handCards.push(new CardObj(cardId));
            });
            var update = JSON.stringify(new GameAction("u4K", handCards, null, playerName));

            var onlySelectedTable = table.getSelected(false);
            var tableCards = [];
            onlySelectedTable.forEach(function (cardId, index) {
                tableCards.push(new CardObj(cardId));
            });
            var update2 = JSON.stringify(new GameAction("u4K", tableCards, null, "table"));

            hub.server.gameAction(roomCode, update);
            hub.server.gameAction(roomCode, update2);
        });
        $('#Kings').on('click', function () {
            showKingOverlay();
        });
        $('.kButton').on('click', function () {
            switch (this.id) {
                case "kHandUse":
                    var handCards = [];
                    var selectedCards = kHand.getSelected(true);
                    var neededNumbers = kNeededHand.slice(0);
                    selectedCards.forEach(function (cardId, index) {
                        var ind = neededNumbers.indexOf(getCardNumber(cardId));
                        if (ind != -1) {
                            handCards.push(new CardObj(cardId.split('_')[0])); // get rid of "_kHand" at end of regular card id
                            neededNumbers.splice(ind, 1);
                        }
                    });
                    var update = JSON.stringify(new GameAction("u4K", handCards, null, playerName));
                    hub.server.gameAction(roomCode, update);
                    break;
                case "kTableUse":
                    var tableCards = [];
                    var selectedCards = kTable.getSelected(true);
                    var neededNumbers = kNeededTable.slice(0);
                    selectedCards.forEach(function (cardId, index) {
                        var ind = neededNumbers.indexOf(getCardNumber(cardId));
                        if (ind != -1) {
                            tableCards.push(new CardObj(cardId.split('_')[0]));
                            neededNumbers.splice(ind, 1);
                        }
                    });
                    var update = JSON.stringify(new GameAction("u4K", tableCards, null, "table"));
                    hub.server.gameAction(roomCode, update);
                    break;
                case "kPlayerDrop":
                    if (playerInfo.length > 2) {
                        if ($('#kPlayerMenu').css("display") == "none") {
                            $('#kPlayerMenu').show();
                            //Done on show instead of on resize because the element doesn't have height yet on first resize
                            $('#kPlayerMenu').css("top", (deckheights[size] - buttonheights[size]) / 2 - $('#kPlayerMenu').height() - 10);
                        } else {
                            $('#kPlayerMenu').hide();
                        }
                    } else {
                        //var playerToAsk = this.innerHTML;
                        var playerToAsk = null;
                        for (var i = 0; i < 2; i++) {
                            if (playerInfo[i].playerName != playerName) {
                                playerToAsk = playerInfo[i].playerName;
                            }
                        }
                        askFromPlayer(playerToAsk);
                    }
                    break;
                default:
                    break;
            }
        });
        $('#kPlayerMenu').on('click', '.pButton', function () {
            var playerToAsk = this.innerHTML;
            askFromPlayer(playerToAsk);
        });
        $('#josPlayerMenu').on('click', '.pButton', function () {
            clearActions();
            e('josPlayerMenu').hide();
            var usedCard = new CardObj(hand.getSelected(true)[0]);
            var update = JSON.stringify(new GameAction("useJ", [usedCard], null, this.innerHTML));
            hub.server.gameAction(roomCode, update);
        });
        $('.kClose').on('click', function () {
            if (history.state != null && history.state.sub == "king") {
                window.history.back();
            }
        });
        $('#ThisPlayerKings').on('click', function () {
            showKingOverlay();
        });
        $('.kingOverlay').on('click', function () {
            kOuterClick = true;
            setTimeout(kingOverlayOuterClick, 5);
        });
        $('#kingContent').on('click', function () {
            setTimeout(kingOverlayInnerClick, 3);
        });
    });
});