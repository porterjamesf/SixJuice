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
        $('#waitList').empty();
        for (var i = 0; i < playerInfo.length; i++) {
            if (!playerInfo[i].ready) {
                $('#waitList').append('<span class="smallText spiv">'.concat(playerInfo[i].playerName, '</span>'));
                allReady = false;
            }
        }
        if (allReady) {
            $('#wait').hide();
        } else {
            $('#wait').show();
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
        history.pushState({ scrn: "Game", rc: roomCode }, "Game " + roomCode, window.location);
    }
    firePopstate = function (e) {
        //History navigation passed down from layout
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
    setSize = function (selector, wid, hei) {
        $(selector).css("width", wid);
        $(selector).css("height", hei);
    }
    setPosition = function (selector, x, y) {
        $(selector).css("left", x);
        $(selector).css("top", y);
    }

    //Converts a 1 digit number to 2 digit form with a leading 0, and leaves
    // a 2 digit number as it is. Untested with other sized numbers.
    convert = function (num) {
        return num.toString().replace(/^(\d{1})(?!\d)/, '0$1');
    }

    //Returns a properly formatted card Id based on number and suit
    // Number should be 1-13 and suit should be all lower-case and plural
    // e.g.: getCardId(1, "hearts) for ace of hearts
    getCardId = function (number, suit) {
        return "" + suit + convert(number);
    }
    //Opposites
    getCardNumber = function (cardId) {
        return parseInt(cardId.substring(cardId.length - 2, cardId.length), 10);
    }
    getCardSuit = function (cardId) {
        return cardId.substring(0, cardId.length - 2);
    }

    //Loads up the appropriate card image to the card element with the specified id
    // Card id's should match the image names.
    addCardGraphic = function (id, isFront) {
        imagePath = '"../../Content/Images/Back.png"';
        if (isFront) {
            imagePath = '"../../Content/Images/deckfronts/' + id + '.png"';
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
    relY = function (event, element) {
        return event.clientY - element.position().top - pagemargins[size];
    }

    //Shortcut for getting elements by id
    e = function (id) {
        return $('#' + id);
    }

    //------------------------------------------
    //      GAME ENGINE
    //------------------------------------------

    //-----GLOBAL BEHAVIOR PARAMETERS-----

    dragMinimum = 5; //Minimum number of pixels mouse must move while down to be a drag

    //-----GLOBAL GRAPHICS PARAMETERS-----
    //All sizes based off of card widths: set freely (any number). Graphic max size is 180. Recommended min is 50.
    cardwidths = [50, 60, 72, 87, 104, 125, 150, 180];
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
    buttonWidthMaxs = [];   //Maximum width of action buttons
    buttonWidth = 0;        //Actual calculated button width (may be less when many actions are enabled)
    buttonheights = [];     //Height of action buttons
    pagemargins = [];       //Margin on page outer border
    widthbreakpoints = [];  //Width minimums for each size
    heightbreakpoints = []; //Height minimums for each size
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
    }
    //Variables
    width = 0; //Total screen dimensions, set on window sizing events
    height = 0;
    size = 0; //Index into sizing arrays, calculated on window sizing events using breakpoints

    //-----SIZING EVENT-----------
    resize = function (wid, hei) {
        //Set size of window
        width = wid - 2 * pagemargins[size] - 1;
        height = hei - 2 * pagemargins[size] - 1;
        setSize('.notYourTurn', wid - 1, hei - 1);
        setSize('.gameboard', width, height);
        $('.gameboard').css("padding", pagemargins[size]);
        //Find sizing index
        for (var i = 0; i < cardwidths.length; i++) {
            if (width < widthbreakpoints[i] || height < heightbreakpoints[i]) {
                break;
            }
            size = i;
        }
        //Set element sizes
        setSize('.card', cardwidths[size], cardheights[size]);
        setSize('.emptyCard', cardwidths[size], cardheights[size]);
        setPosition('.emptyCard', deckmargins[size], deckmargins[size]);
        $('.card').css("background-size", "" + cardwidths[size] + "px " + cardheights[size] + "px");
        setSize('.deck', deckwidths[size], deckheights[size]);
        $('.cardBar').css("top", deckmargins[size] + rowmargins[size]);
        $('.cardBar').css("height", cardheights[size]);
        $('.king').css("top", deckmargins[size] + rowmargins[size]);
        $('.boardrow').css("height", deckheights[size]);
        $('.boardrow').css("padding", rowmargins[size]);
        //Set element positions
        var xcursor = rowmargins[size] + deckwidths[size] + standardmargins[size]; //After 1 deck
        e('table').css("left", xcursor);
        $('.normalCardPile').css("left", xcursor);
        xcursor += deckwidths[size] + standardmargins[size]; //After 1 more deck
        $('.hand').css("left", xcursor);
        //        Calculating hand width (Total width minus 2 decks & 1/2 a card for the first king)
        calcedHandWidth = Math.max(handmins[size], Math.min(handmaxs[size], width - xcursor - standardmargins[size] - 0.5 * cardwidths[size]));
        $('.hand').css("width", calcedHandWidth);
        e('table').css("width", calcedHandWidth + cardwidths[size] + cardmargins[size]);
        calculateKingAndPlayerWidths();

        drawables.forEach(function (drawable, index) {
            drawable.redraw();
        });

        //Action buttons - at end so that we can grab scrollwidth after all the gameboard elements have their positions set
        //setSize('.actionButtons', document.getElementsByClassName('gameboard')[0].scrollWidth, buttonheights[size] + standardmargins[size]);
        setSize('.actionButtons', width, buttonheights[size] + 2 * standardmargins[size]);
        //$('.actionButtons').css("height", buttonheights[size] + 2 * standardmargins[size]);
        $('#buttonSpace').css("height", buttonheights[size] + 2 * standardmargins[size]);
        calculateButtonWidth();
        $('.actionButton').css("height", buttonheights[size]);
        $('.actionButton').css("margin", standardmargins[size] + "px");
    }
    calculateKingAndPlayerWidths = function () {
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
    clearActions = function () {
        var actions = $('.actionButtons button');
        for (var i = 0; i < actions.length; i++) {
            disableAction(actions[i].id);
        }
    }
    calculateButtonWidth = function () {
        var actions = $('.actionButtons button');
        var enabledActionCount = 0;
        for (var i = 0; i < actions.length; i++) {
            if (!e(actions[i].id).css("display") == "none") {
                enabledActionCount += 1;
            }
        }
        buttonWidth = Math.min((width - 20) / enabledActionCount - 2 * standardmargins[size], buttonWidthMaxs[size]);
        $('.actionButton').css("width", buttonWidth);
    }

    //--------TURN----------

    updateTurn = function () {
        if (whosTurn == playerName) {
            $('.notYourTurn').hide();
        } else {
            $('.notYourTurn').show();
            $('.cardSelected').removeClass('cardSelected');
        }
    }

    //---------CLASSES------------

    //Class for the main draw deck, as well as point card and normal card piles
    function Deck(id) {
        this.id = id;
        this.cardList = [];
        e(this.id).append(getCardHole());

        this.pushCard = function (cardId) {
            if (this.cardList.length > 0) {
                removeCardGraphic(this.cardList[this.cardList.length - 1]);
            } else {
                e(this.id).empty();
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
                e(this.id).empty();
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
            } else {
                e(this.id).append(getCardHole());
            }
        }

        this.clear = function () {
            this._clear();
            this.redraw();
        }
        this._clear = function () {
            this.cardList = [];
            e(this.id).empty();
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
                    e(this.cardList[i]).css("left", Math.max(deckmargins[size] - i, 0));
                    e(this.cardList[i]).css("top", Math.max(deckmargins[size] - i, 0));
                }
            }
        }

        e(this.id).on('mouseup', (function (event) {
            //Click on deck -- for jack of spades
            // May be replaced with overlay
        }).bind(this));
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
        // Display fields
        this.width = 0; //Width of element, set by HTML
        this.baseWidth = 0; //Baseline width per card, calculated each redraw

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
            updateActions();
        }
        // Returns list of selected cards
        this.getSelected = function () {
            var result = [];
            this.cardList.forEach(function (cardID, index) {
                if (e(cardID).hasClass("cardSelected")) {
                    result.push(cardID);
                }
            });
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
                clickx = relX(event, e(this.id));
                clicky = relY(event, e(getCardBarContainerId(this.id)));
                var containerId = getCardBarContainerId(this.id);
                //console.log("click (" + clickx + ", " + clicky + ")");
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
                var cardId = getCardId(cards[i].number, cards[i].suit);
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

        this.removeKing = function (kingId) {
            //Remove element
            var eId = this.id + '-' + kingId;
            e(this.id).remove('#' + eId);
            //Find index of king object and remove it from array
            for (var i = 0; i < this.kings.length; i++) {
                if (this.kings[i].id == eId) {
                    this.kings.splice(i, 1);
                    break;
                }
            }

            this.redraw();
        }

        this.redraw = function () {
            this.kings.forEach(function (king, index) {
                king.redraw();
            });
        }

        this.import = function (cardss) {
            this._import(cardss);
            this.redraw();
        }
        this._import = function (cardss) {
            for (var i = 0; i < cardss.length; i++) {
                var eId = this.id + '-' +  getCardId(cardss[i][0].number, cardss[i][0].suit);
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

    getCardBarContainerId = function (cardBarId) {
        switch (cardBarId) {
            case "table":
                return "top";
            case "hand":
                return "ThisPlayer";
            default:
                return cardBarId.replace("Hand", "");
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
    }

    //----------GAME---------------

    //Game state variables
    drawpile = new Deck("drawpile");
    table = new CardBar("table", true);
    whosTurn = "";

    pointCardPile = new Deck("pointCardPile");
    normalCardPile = new Deck("normalCardPile");
    hand = new CardBar("hand", true);
    kings = new Kings("ThisPlayerKings");

    otherPlayers = [];

    drawables = [];
    drawables.push(drawpile);
    drawables.push(table);
    drawables.push(pointCardPile);
    drawables.push(normalCardPile);
    drawables.push(hand);
    drawables.push(kings);

    //Complete update of the board from the database
    hub.client.receivePlayerGameState = function (pgsdata) {
        pgs = JSON.parse(pgsdata);

        //Drawpile
        drawpile.clearAndImport(pgs.DeckCount, null);

        //Table
        gameTable = [];
        for (var i = 0; i < pgs.Table.length; i++) {
            gameTable.push(getCardId(pgs.Table[i].number, pgs.Table[i].suit));
        }
        table.clearAndImport(gameTable);

        //Turn
        whosTurn = pgs.WhosTurn;
        updateTurn();

        //This player
        pointCardPile.clearAndImport(pgs.PointCardCount, null);
        var normalTopCard = null;
        if (pgs.NormalCards.Count > 0) {
            normalTopCard = getCardId(pgs.NormalCards.Top.number, pgs.NormalCards.Top.suit);
        }
        normalCardPile.clearAndImport(pgs.NormalCards.Count, normalTopCard);
        gameHand = [];
        for (var i = 0; i < pgs.Hand.length; i++) {
            gameHand.push(getCardId(pgs.Hand[i].number, pgs.Hand[i].suit));
        }
        hand.clearAndImport(gameHand);
        kings.clearAndImport(pgs.Kings);

        //Other players
        otherPlayers = [];
        for (var i = 0; i < pgs.OtherPlayers.length; i++) {
            opName = pgs.OtherPlayers[i].PlayerName;
            op = null;

            //Find/create other player
            if ($('#' + opName).length == 0) {
                e('players').append('<div id="' + opName + '" class="boardrow"></div>');
                e(opName).append('<span id="' + opName + 'PointCardPile" class="deck"></span>');
                e(opName).append('<span id="' + opName + 'NormalCardPile" class="deck normalCardPile"></span>');
                e(opName).append('<span id="' + opName + 'Hand" class="cardBar hand"></span>');
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
                drawables.push(op.kings);
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
                opNormalTopCard = getCardId(pgs.OtherPlayers[i].NormalCards.Top.number, pgs.OtherPlayers[i].NormalCards.Top.suit);
            }
            op.normalCardPile.clearAndImport(pgs.OtherPlayers[i].NormalCards.Count, opNormalTopCard);
            ophand = [];
            for (j = 0; j < pgs.OtherPlayers[i].HandCount; j++) {
                ophand.push(opName + "Handc" + j);
            }
            op.hand.clearAndImport(ophand);
            op.kings.clearAndImport(pgs.OtherPlayers[i].Kings);
        }

        resize(window.innerWidth, window.innerHeight);
    }

    hub.client.receivePlayerGameAction = function(pgadata) {
        var pga = JSON.parse(pgadata);
        switch (pga.action) {
            case "discard":
                //Removing discarded card from hand
                if (pga.playerName == playerName) {
                    hand.removeCard(getCardId(pga.hand[0].number, pga.hand[0].suit));
                } else {
                    for (var i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == pga.playerName) {
                            otherPlayers[i].hand.popCard();
                        }
                    }
                }
                //Adding drawn cards/reducing drawpile
                if (pga.misc == playerName) {
                    for (var j = 0; j < pga.table.length; j++) {
                        hand.pushCard(getCardId(pga.table[j].number, pga.table[j].suit));
                        drawpile.popCard();
                    }
                } else {
                    for (var i = 0; i < otherPlayers.length; i++) {
                        if (otherPlayers[i].name == pga.misc) {
                            for (var j = 0; j < pga.table.length; j++) {
                                otherPlayers[j].hand.pushBlankCard();
                                drawpile.popCard();
                            }
                        }
                    }
                }
                //Adding discarded card to Table
                table.pushCard(getCardId(pga.hand[0].number, pga.hand[0].suit));
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
        var selectedHand = hand.getSelected();
        if (selectedHand.length > 0) {
            var selectedTable = table.getSelected()
            var onlyNumbered = true;
            if (selectedHand.length == 1) {
                enableAction("Discard");
                var selNum = getCardNumber(selectedHand[0]);
                var selSuit = getCardSuit(selectedHand[0]);
                //Sweep, play King, use Cat
                if (selNum == 12 || selNum == 13 || (selNum == 11 && selSuit == "spades")) {
                    enableAction("Use");
                    onlyNumbered = false;
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
                    enableAction("Take");
                }
                // TODO - Logic for Use for Kings action
            } else {
                
            }
        }
        // TODO - logic for Kings, End Turn actions
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
            hand.getSelected().forEach(function(cardId, index) {
                handCards.push(new CardObj(cardId));
            });
            var tableCards = [];
            table.getSelected().forEach(function(cardId, index) {
                tableCards.push(new CardObj(cardId));
            });
            var update = JSON.stringify(new GameAction("take", handCards, tableCards, null));
            hub.server.gameAction(roomCode, update);
        });
        $('#Use').on('click', function () {
            console.log("Use");
        });
        $('#Discard').on('click', function () {
            clearActions();
            var update = JSON.stringify(new GameAction("discard", [new CardObj(hand.getSelected()[0])], null, null));
            hub.server.gameAction(roomCode, update);
        });
        $('#EndTurn').on('click', function () {
            console.log("End Turn");
        });
        $('#UseforKing').on('click', function () {
            console.log("Use for King");
        });
        $('#Kings').on('click', function () {
            console.log("Kings");
        });
    })
});