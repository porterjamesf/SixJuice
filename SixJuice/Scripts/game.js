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

    //Loads up the appropriate card image to the card element with the specified id
    // Card id's should match the image names.
    addCardGraphic = function (id, isFront) {
        imagePath = '"../../Content/Images/Back.png"';
        if (isFront) {
            imagePath = '"../../Content/Images/deckfronts/' + id + '.png"';
        }
        $('#' + id).css("background-image", 'url(' + imagePath + ')');
    }

    //Helpers for getting coordinates relative to element mouse event occured on, in same
    // coordinate space as the sub-elements' (cards') left and top positions
    relX = function (event, element) {
        return event.clientX - element.position().left - element.css("margin-left").replace("px", "") - 15;
    }
    relY = function (event, element) {
        return event.clientY - element.position().top - element.css("margin-top").replace("px", "") - 15;
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

    cardWidth = 70; //TODO: find this dynamically
    cardMinimumWidth = 10; //Smallest baseline width: card bar will size itself larger
                            // than preferred width if necessary to accomodate this
    cardMargin = 5; //Margin between cards when there is room to lay them all out

    //---------CLASSES------------

    //Class for the main draw deck, as well as point card and normal card piles
    function Deck(id) {
        this.id = id;
        this.cardCount = 0;
        this.topCard = null;

        this.redraw = function () {
            e(this.id).empty();
            if (this.cardCount == 0) {
                e(this.id).append(getCardHole());
            } else {
                var i = 0;
                for (i = 0; i < this.cardCount - 1; i++) {
                    e(this.id).append(getCardDiv(this.id + "c" + i));
                    e(this.id + "c" + i).css("left", Math.max(15 - i, 0));
                    e(this.id + "c" + i).css("top", Math.max(0 - i, -15));
                }
                if (this.topCard == null) {
                    e(this.id).append(getCardDiv(this.id + "cT"));
                    addCardGraphic(this.id + "cT", false);
                    e(this.id + "cT").css("left", Math.max(14 - i, 0));
                    e(this.id + "cT").css("top", Math.max(-1 - i, -15));
                } else {
                    e(this.id).append(getCardDiv(this.topCard));
                    addCardGraphic(this.topCard, true);
                    e(this.topCard).css("left", Math.max(14 - i, 0));
                    e(this.topCard).css("top", Math.max(-1 - i, -15));
                }
            }
        }

        e(this.id).on('mouseup', (function (event) {
            //Click on deck -- for cat
            // May be replaced with overlay
        }).bind(this));
    }

    //Class for the table, hands, and card lists in Spell overlay
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
        // Removes specific card from list
        this.removeCard = function (cardId) {
            //Removes card element from DOM
            $('#' + this.id + " #" + cardId).remove();
            //Removes id from list
            index = this.cardList.indexOf(cardId);
            this.cardList.splice(index, 1);
            //Readjusts scroll position if necessary
            this.pos = Math.min(cardList.length - 2, this.pos);

            this.redraw();
        }
        // Selects/unselects specific card
        this.toggleSelectCard = function (cardId) {
            cardE = e(cardId);
            if (cardE.hasClass("cardSelected")) {
                cardE.removeClass("cardSelected");
            } else {
                cardE.addClass("cardSelected");
            }
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

            //Set to preferred width
            this.width = barE.attr('data-preferredWidth');
            barE.width(this.width);
            //Re-set card size in case of change
            cardWidth = parseInt(e(this.cardList[0]).css('width').replace("px",""), 10);

            //Move first card to 0
            e(this.cardList[0]).css('left', 0);
            //Position all cards, and adjust width if it is below minimum
            switch (this.cardList.length) {
                case 0:
                case 1:
                    if (this.width < cardWidth) {
                        barE.width(cardWidth);
                        this.width = cardWidth;
                    }
                    return;
                case 2:
                    if (this.width < 2 * cardWidth) {
                        barE.width(2 * cardWidth);
                        this.width = 2 * cardWidth;
                    }
                    e(this.cardList[1]).css('left', Math.min(this.width - cardWidth, cardWidth + cardMargin));
                    return;
                default:
                    //If not active, or if there's more than enough room for all the cards, they are simply
                    // arrayed out. In the former case, if there's not enough room, they will be layed out
                    // with equal spacing.
                    if (!this.isActive || this.width > this.cardList.length * cardWidth) {
                        for (var i = 1; i < this.cardList.length; i++) {
                            e(this.cardList[i]).css('left', Math.min((this.width - cardWidth)*i / (this.cardList.length - 1), (cardWidth + cardMargin)*i));
                        }
                    }
                    //If active without enough room for all cards, the baseline width per card is calculated
                        // and they are each assigned that much space. The position value is used to determine which
                        // card or two cards to give a little more space, so that you can scroll through the cards
                    else {
                        //This minimum width accounts for 2 full-width cards and the rest at the minimum width
                        minWidth = 2 * cardWidth + (this.cardList.length - 2) * cardMinimumWidth;
                        if (this.width < minWidth) {
                            barE.width(minWidth);
                            this.width = minWidth;
                        }
                        //The baseline width is the total width minus 2 full-width cards divided equally amongst the rest
                        this.baseWidth = (this.width - 2 * cardWidth) / (this.cardList.length - 2);
                        for (var i = 1; i < this.cardList.length; i++) {
                            x = 0;
                            if (this.pos <= i - 1) { //Current card is after scroll position
                                x = (i - 1) * this.baseWidth + cardWidth;
                            } else {
                                if (this.pos >= i) { //Current card is before scroll position
                                    x = i * this.baseWidth;
                                } else { //Current card is the one moving with scroll
                                    x = i * this.baseWidth + (1 - this.pos % 1) * (cardWidth - this.baseWidth);
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
                    this.changePos(Math.min(Math.max(dragDistance / (cardWidth - this.baseWidth) + this.downpos, 0), this.cardList.length - 2));
                    this.dragged = true;
                }
            }
        }).bind(this));
        e(this.id).on('mouseup mouseleave', (function (event) {
            //Stops mouse operation. For drags, that's the end of the story
            this.downat = -1;
            this.downpos = -1;
            //Detects a click (on active card bars) and performs selection
            if (event.type == "mouseup" && !this.dragged && this.isActive) {
                clickx = relX(event, e(this.id));
                clicky = relY(event, e(this.id));
                //console.log("click (" + clickx + ", " + clicky + ")");
                for (var i = this.cardList.length - 1; i >= 0; i--) {
                    cardx = e(this.cardList[i]).position().left;
                    if (clickx >= cardx && clickx < cardx + cardWidth) {
                        if (clicky < 0 && !e(this.cardList[i]).hasClass("cardSelected")) {
                            continue;
                        }
                        // TODO: insert code for detecting click below bottom of selected card
                        this.toggleSelectCard(this.cardList[i]);
                        return;
                    }
                }
            }
        }).bind(this));
    }

    function OtherPlayer(pointCards, normalCards, hand) {
        this.pointCardPile = pointCards;
        this.normalCardPile = normalCards;
        this.hand = hand;
    }

    //----------GAME---------------

    drawpile = new Deck("drawpile");
    table = new CardBar("table", true);

    pointCardPile = new Deck("pointCardPile");
    normalCardPile = new Deck("normalCardPile");
    hand = new CardBar("hand", true);

    otherPlayers = [];

    //Complete update of the board from the database
    hub.client.receivePlayerGameState = function (pgsdata) {
        pgs = JSON.parse(pgsdata);

        //Drawpile
        drawpile.cardCount = pgs.DeckCount;
        drawpile.redraw();

        //Table
        gameTable = [];
        for (var i = 0; i < pgs.Table.length; i++) {
            gameTable.push(getCardId(pgs.Table[i].number, pgs.Table[i].suit));
        }
        table.clearAndImport(gameTable);

        //This player
        pointCardPile.cardCount = pgs.PointCardCount;
        normalCardPile.cardCount = pgs.NormalCards.Count;
        if (normalCardPile.cardCount > 0) {
            normalCardPile.topCard = getCardId(pgs.NormalCards.Top.number, pgs.NormalCards.Top.suit);
        }
        pointCardPile.redraw();
        normalCardPile.redraw();
        gameHand = [];
        for (var i = 0; i < pgs.Hand.length; i++) {
            gameHand.push(getCardId(pgs.Hand[i].number, pgs.Hand[i].suit));
        }
        hand.clearAndImport(gameHand);

        //Other players
        e('players').empty();
        otherPlayers = [];
        for (var i = 0; i < pgs.OtherPlayers.length; i++) {
            opName = pgs.OtherPlayers[i].PlayerName;

            //HTML generation
            e('players').append('<div id="' + opName + '" class="boardrow" style="top: ' + (150*i + 300) + 'px;"></div>');
            e(opName).append('<span id="' + opName + 'PointCardPile" class="deck"></span>');
            e(opName).append('<span id="' + opName + 'NormalCardPile" class="deck post1deck"></span>');
            e(opName).append('<span id="' + opName + 'Hand" class="cardBar post2decks" data-preferredwidth="160"></span>');

            //Data
            op = new OtherPlayer(
                new Deck(opName + "PointCardPile"),
                new Deck(opName + "NormalCardPile"),
                new CardBar(opName + "Hand", false)
            );
            op.pointCardPile.cardCount = pgs.OtherPlayers[i].PointCardCount;
            op.normalCardPile.cardCount = pgs.OtherPlayers[i].NormalCards.Count;
            if (op.normalCardPile.cardCount > 0) {
                op.normalCardPile.topCard = getCardId(pgs.OtherPlayers[i].NormalCards.Top.number, pgs.OtherPlayers[i].NormalCards.Top.suit);
            }
            op.pointCardPile.redraw();
            op.normalCardPile.redraw();
            ophand = [];
            for (j = 0; j < pgs.OtherPlayers[i].HandCount; j++) {
                ophand.push(opName + "c" + j);
            }
            op.hand.import(ophand);

            otherPlayers.push(op);
        }

    }
});