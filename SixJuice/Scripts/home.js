$(function () {
    hub = $.connection.sixJuiceHub;
    screen = "start"; //changes to "room" or "rejoin"
    roomCode = "";
    playerName = "";
    playerInfo = null;
    ready = false;
    decks = 1
    starting = false;     //just a flag so that the disconnects that happen on start won't visually change player statuses

    $('#setName').prop('disabled', false);
    $('#name').prop('disabled', false);
    $('#go').text("READY");
    $('#go').prop('disabled', false);

    //-------- SIZING --------------

    width = 0;      //Total width, set on window sizing events
    height = 0;     //Total height

    defaultMargin = 15;      //Default margin value to use in between elements
    minSideMargin = 20;     //Minimum margin on sides buffering the big buttons
    boxWidths = [          //Minimum and maximum widths:
        120, 400,               // Standard button
        70, 815,                // "SixJuice" - max should be at least 2x button width + default margin
        60, 200,                // "Room Code:"
        120, 400,               // "<the room code>"
        70, 400,                // Player list
        60, 400,                // "Your Name:"
        70, 1000,               // Message bar at bottom (no max)
        60, 133,                // Decks drop-down
        40, 70,                 // "Decks"
        60, 370,                // Your name text box
        15, 80,                 // Your name OK button
        120, 815                // Rejoin list
    ];
    boxHeights = [          //Minimum and maximum heights:
        30, 100,               // Standard button
        30, 160,               // "SixJuice"
        12, 40,                // "Room Code:"
        30, 100,               // "<the room code>"
        30, 1000,              // Player list (no max)
        20, 40,                // "Your Name:"
        30, 100,               // Message bar at bottom
        20, 40,                // Decks drop-down
        20, 40,                // "Decks"
        30, 90,                // Your name text box
        30, 90,                // Your name OK button
        60, 1000               // Rejoin list (no max)
    ];
    enums = [
        "Button", //If you change the enum order, always leave this one first
        "SixJuice",
        "RoomCode",
        "RoomCodeValue",
        "PlayerList",
        "YourName",
        "Message",
        "DecksDDL",
        "Decks",
        "NameBox",
        "NameOK",
        "RejoinList"
    ];
    calcedWidths = [];
    calcedHeights = [];
    widthOf = function(name) {
        return calcedWidths[enums.indexOf(name)];
    }
    heightOf = function(name) {
        return calcedHeights[enums.indexOf(name)];
    }

    isPortrait = true;

    // Sizing event
    resize = function (wid, hei) {
        isPortrait = hei > wid;
        calcedWidths = [];
        calcedHeights = [];

        // Calculation of sizes
        enums.forEach(function (value, index) {
            wresult = 0;
            hresult = 0;
            switch (value) {
                case "Button":
                    wresult = (wid - 2 * minSideMargin) / (isPortrait ? 1 : 2) - (isPortrait ? 0 : defaultMargin);
                    hresult = hei / (isPortrait ? 6.0 : 4.0) - defaultMargin;
                    break;
                case "SixJuice":
                    wresult = wid - 2 * minSideMargin;
                    hresult = calcedHeights[0];
                    break;
                case "RoomCode":
                    wresult = calcedWidths[0] / 2;
                    hresult = calcedHeights[0] * 0.4;
                    break;
                case "RoomCodeValue":
                    wresult = calcedWidths[0];
                    hresult = maprange(Math.min(wid, hei * 2), 200, 850, 35, 85)
                    break;
                case "PlayerList":
                    wresult = calcedWidths[0];
                    hresult = hei - (calcedHeights[0] * (isPortrait ? 3.6 : 0.7) + heightOf("RoomCodeValue") + defaultMargin * (isPortrait ? 5 : 2));
                    break;
                case "YourName":
                    wresult = calcedWidths[0];
                    hresult = calcedHeights[0] * 0.4;
                    break;
                case "Message":
                    wresult = wid - 2 * minSideMargin;
                    hresult = calcedHeights[0] * 0.7;
                    break;
                case "DecksDDL":
                    wresult = calcedWidths[0] / 3;
                    hresult = calcedHeights[0] * 0.4;
                    break;
                case "Decks":
                    wresult = calcedWidths[0] / 2;
                    hresult = calcedHeights[0] * 0.4;
                    break;
                case "NameBox":
                    wresult = calcedWidths[0] * 0.8 - defaultMargin;
                    hresult = calcedHeights[0] * 0.7;
                    break;
                case "NameOK":
                    wresult = calcedWidths[0] * 0.2;
                    hresult = calcedHeights[0] * 0.7;
                    break;
                case "RejoinList":
                    wresult = calcedWidths[0] + (isPortrait ? 0 : calcedWidths[0] + defaultMargin);
                    hresult = hei - (isPortrait ? heightOf("RoomCode") : 0) - heightOf("RoomCodeValue") - heightOf("Message") - defaultMargin * 4;
                default: break;
            }
            calcedWidths.push(Math.max(Math.min(wresult, boxWidths[index * 2 + 1]), boxWidths[index * 2]));
            calcedHeights.push(Math.max(Math.min(hresult, boxHeights[index * 2 + 1]), boxHeights[index * 2]));
        });

        //Placing elements and sizing text (text sizes are simply calibrated in testing)
        x = (wid - widthOf("SixJuice")) / 2;
        y = defaultMargin;
        leftside = isPortrait ? (wid - widthOf("Button")) / 2 : x;
        switch (screen) {
            case "start":
                setSize('#SixJuiceBox', widthOf("SixJuice"), heightOf("SixJuice"));
                setPosition('#SixJuiceBox', x, y);
                $('#SJBtext').css({ "font-size": maprange(Math.min(wid, hei * 2), 250, 700, 35, 85) });
                $('#SixJuiceBox').css({ "transform": "translateY(" + (isPortrait ? 30 : -15) + "%)" });

                x = leftside;

                setSize("#EnterRCBox", widthOf("Button"), heightOf("Button"));
                y += heightOf("SixJuice") + defaultMargin;
                setPosition("#EnterRCBox", x, y);
                $('#EnterRCBox').css({
                    "font-size": maprange(Math.min(wid, hei * 2), 250, 700, 15, 35), "text-align": isPortrait ? "left" : "right",
                    "transform": "translateY(" + (isPortrait ? 65 : 30) + "%)"
                });

                setSize("#roomCodeValue", widthOf("Button") - 34, heightOf("Button") - 2); // Offsets are for border/margin, which are treated differently in an input vs. a button
                isPortrait ? y += heightOf("Button") + defaultMargin : x += widthOf("Button") + defaultMargin;
                setPosition("#roomCodeValue", x, y);
                $('#roomCodeValue').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 700, 25, 60) });

                setSize("#joinButton", widthOf("Button"), heightOf("Button"));
                y += heightOf("Button") + defaultMargin;
                x = leftside;
                setPosition("#joinButton", x, y);
                $('#joinButton').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 650, 15, 40) });

                setSize("#newButton", widthOf("Button"), heightOf("Button"));
                isPortrait ? y += heightOf("Button") + defaultMargin : x += widthOf("Button") + defaultMargin;
                setPosition("#newButton", x, y);
                $('#newButton').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 650, 15, 40) });
                $('#newButton').text(!isPortrait && wid < 350 ? "NEW" : "NEW GAME");

                setSize("#startMessage", widthOf("Message"), heightOf("Message"));
                y += heightOf("Button") + defaultMargin;
                x = leftside;
                setPosition("#startMessage", x, y);
                $('#startMessage').css({ "font-size": Math.min(maprange(isPortrait ? wid : wid / 2, 200, 450, 15, 20), maprange(hei * (isPortrait ? 1 : 1.35), 400, 700, 15, 20)) });

                break;
            case "room":
                x = leftside;
                rightside = leftside + widthOf("Button") + defaultMargin;

                setSize('#roomCodeBox', widthOf("RoomCode"), heightOf("RoomCode"));
                setPosition('#roomCodeBox', x, y);
                $('#roomCodeBox').css({
                    "font-size": maprange((isPortrait ? 1.1 : 0.7) * Math.min(wid, hei * 2), 250, 800, 15, 35), "text-align": isPortrait ? "left" : "right",
                    "transform": "translateY(" + (isPortrait ? 65 : 30) + "%)"
                });

                setSize('#roomRoomCode', widthOf("RoomCodeValue"), heightOf("RoomCodeValue"));
                isPortrait ? y += heightOf("RoomCode") + defaultMargin : x += widthOf("RoomCode") + defaultMargin;
                setPosition('#roomRoomCode', x, y);
                $('#roomRoomCode').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 850, 35, 85) });

                y += heightOf("RoomCodeValue") + defaultMargin;
                landscapeYSave1 = y;

                setSize('#decks', widthOf("DecksDDL"), heightOf("DecksDDL"));
                x = isPortrait ? leftside : rightside;
                setPosition('#decks', x, y);
                $('#decks').css({
                    "font-size": maprange(Math.min(isPortrait ? wid : wid / 2, hei), 250, 600, 15, 35)
                });

                setSize('#decksText', widthOf("Decks"), heightOf("Decks"));
                x += widthOf("DecksDDL") + defaultMargin;
                setPosition('#decksText', x, y);
                $('#decksText').css({
                    "font-size": Math.min(maprange(wid, 200, 450, 20, 45), maprange(hei, 300, 600, 18, 25)),
                    "transform": "translateY(" + maprange(hei, 300, 700, 10, 20) + "%)"
                });

                setSize('#nameText', widthOf("YourName"), heightOf("YourName"));
                x = isPortrait ? leftside : rightside;
                y += heightOf("Decks"); //Note: no margin here
                setPosition('#nameText', x, y);
                $('#nameTextText').css({
                    "font-size": Math.max(Math.min((Math.min(isPortrait ? wid : wid / 2, hei) - 250) * 2 / 45 + 15, 35), 15)
                });

                setSize('#name', widthOf("NameBox"), heightOf("NameBox") - 6);
                y += heightOf("YourName"); //Note: no margin here
                setPosition('#name', x, y);
                $('#name').css({ "font-size": Math.min(maprange(wid, 200, 750, 15, 35), maprange(hei, 200, 450, 15, 35)) });

                setSize('#setName', widthOf("NameOK"), heightOf("NameOK"));
                x += widthOf("NameBox") + defaultMargin;
                setPosition('#setName', x, y);
                $('#setName').css({ "font-size": Math.min(maprange(isPortrait ? wid: wid /2, 200, 750, 15, 35), maprange(hei, 200, 500, 15, 35)) });

                y += heightOf("NameOK") + defaultMargin;
                landscapeYSave2 = y;

                setSize('#roomPlayerList', widthOf("PlayerList"), heightOf("PlayerList"));
                x = leftside;
                y = isPortrait ? y : landscapeYSave1;
                height = Math.min(maprange(isPortrait ? wid : wid / 2, 200, 450, 17, 27), maprange(hei, 230, 450, 17, 27));
                setPosition('#roomPlayerList', x, y);
                $('#roomPlayerList').css({ "font-size": height });
                $('.rpl_outer').css({ "height": height / 2 + 1 });
                $('#roomPlayerList > div').css({ "height": height });

                landscapeYSave1 = y + heightOf("PlayerList");

                setSize('#go', widthOf("Button"), heightOf("Button"));
                x = isPortrait ? leftside : rightside;
                y = isPortrait ? y + heightOf("PlayerList") + defaultMargin : landscapeYSave2;
                setPosition('#go', x, y);
                $('#go').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 650, 15, 40) });

                setSize('#roomMessage', widthOf("Message"), heightOf("Message"));
                x = leftside;
                y = (isPortrait ? y + heightOf("Button") : landscapeYSave1) + defaultMargin;
                setPosition('#roomMessage', x, y);
                $('#roomMessage').css({ "font-size": Math.min(maprange(isPortrait ? wid : wid / 2, 200, 450, 15, 20), maprange(hei * (isPortrait ? 1 : 1.35), 400, 700, 15, 20)) });

                break;
            case "rejoin":
                x = leftside;
                rightside = leftside + widthOf("Button") + defaultMargin;

                setSize('#rejoinCodeBox', widthOf("RoomCode"), heightOf("RoomCode"));
                setPosition('#rejoinCodeBox', x, y);
                $('#rejoinCodeBox').css({
                    "font-size": maprange((isPortrait ? 1.1 : 0.7) * Math.min(wid, hei * 2), 250, 800, 15, 35), "text-align": isPortrait ? "left" : "right",
                    "transform": "translateY(" + (isPortrait ? 65 : 30) + "%)"
                });

                setSize('#rejoinRoomCode', widthOf("RoomCodeValue"), heightOf("RoomCodeValue"));
                isPortrait ? y += heightOf("RoomCode") + defaultMargin : x += widthOf("RoomCode") + defaultMargin;
                setPosition('#rejoinRoomCode', x, y);
                $('#rejoinRoomCode').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 850, 35, 85) });

                setSize('#rejoinPlayerList', widthOf("RejoinList"), heightOf("RejoinList"));
                x = leftside;
                y += heightOf("RoomCodeValue") + defaultMargin;
                setPosition('#rejoinPlayerList', x, y);

                adjustedButtonWidth = ($('#rejoinPlayerList').prop("clientWidth") - (isPortrait ? 0 : defaultMargin)) / (isPortrait ? 1 : 2);

                setSize('#rejoinPlayerList > button', adjustedButtonWidth, heightOf("Button"));
                $('#rejoinPlayerList > button').each(function (index, button) {
                    $(button).css({ "left": isPortrait ? 0 : (index % 2) * (adjustedButtonWidth + defaultMargin) });
                    $(button).css({ "top": (heightOf("Button") + defaultMargin) * (isPortrait ? index : Math.floor(index / 2)) });
                });
                $('#rejoinPlayerList > button').css({ "font-size": maprange(Math.min(wid, hei * 2), 200, 650, 15, 40) });

                setSize('#rejoinMessage', widthOf("Message"), heightOf("Message"));
                y += heightOf("RejoinList") + defaultMargin;
                setPosition('#rejoinMessage', x, y);
                $('#rejoinMessage').css({ "font-size": Math.min(maprange(isPortrait ? wid : wid / 2, 200, 450, 15, 20), maprange(hei * (isPortrait ? 1 : 1.35), 400, 700, 15, 20)) });
                break;
            default: break;
        }
    }


    //----------- START ----------------

    $('#roomCodeValue').focus();

    //Switches screen to Room, populates some page variables and objects, and joins game in server
    hub.client.goToRoomAs = function (destRoomCode, initPlayerName) {
        screen = "room";
        $('#startPane').addClass("hiddenPane");
        resize(window.innerWidth, window.innerHeight);
        $('#roomPane').removeClass("hiddenPane");
        message("Joining room...", false);

        roomCode = destRoomCode;
        playerName = initPlayerName;
        $('#roomRoomCode').text(roomCode);
        $('#name').val(playerName);

        hub.server.joinRoomAs(roomCode, playerName);
        data = { text: "rl" };
        history.pushState({ screen: "room", rc: roomCode }, "Rooom ".concat(roomCode), window.location);
    }

    //Callback for error during room joining on server side
    hub.client.cancelJoinRoom = function () {
        backToStart();
        message("Could not join room.", true);
    }

    //Game rejoin callback - for joining game-in-progress
    hub.client.goToRejoin = function (destRoomCode) {
        screen = "rejoin";
        $('#startPane').addClass("hiddenPane");
        $('#rejoinPane').removeClass("hiddenPane");
        resize(window.innerWidth, window.innerHeight);

        roomCode = destRoomCode;
        playerName = "";
        $('#rejoinRoomCode').text(roomCode);

        hub.server.rejoin(roomCode);
        history.pushState({ screen: "rejoin", rc: roomCode }, "Rejoin ".concat(roomCode), window.location);
    }

    //Room code validation
    oldtext = "";
    validateRoomCode = function () {
        text = $('#roomCodeValue').val().toUpperCase();
        if (/^[A-Z0-9]{0,4}$/.test(text)) {
            $('#roomCodeValue').val(text);
            oldtext = text;
        } else {
            $('#roomCodeValue').val(oldtext);
        }
        $('#joinButton').prop('disabled', $('#roomCodeValue').val().length != 4);
    }
    $('#roomCodeValue').on("change keyup paste", function () {
        validateRoomCode();
    });
    validateRoomCode(); // Do one validation on load, for when we get here via Back with the input data cached

    //------------ ROOM ----------------

    //Receives player updates
    hub.client.sendPlayerList = function (players) {
        if (!starting) {
            playerInfo = JSON.parse(players);
            $('#roomPlayerList').empty();
            for (i = 0; i < playerInfo.length; i++) {
                $('#roomPlayerList').append('<div><div class="rpl_outer"><span class="rpl_inner">' + playerInfo[i].playerName + '<span class="readyMarker' +
                    (playerInfo[i].ready ? 'Y rpl_inner">&#x2713;' : 'N rpl_inner">X') + '</span></span></div></div>');
            }
            setDecksDDLEnablement(!ready);
            resize(window.innerWidth, window.innerHeight);
            message("", false);
        }
    }

    setDecksDDLEnablement = function (enable) {
        if (!enable || playerInfo[0].playerName != playerName) {
            $('#decks').prop('disabled', true);
        } else {
            $('#decks').prop('disabled', false);
        }
    }

    //Callback for validation of name change
    hub.client.nameChangeCallback = function (name, fail) {
        if (fail) {
            message("The name ".concat(name, " is already taken."), true);
        } else {
            playerName = name;
        }
    }

    //Called on selecting a value from the Decks DDL
    updateDeckCount = function () {
        decks = parseInt($('#decks').val());
        hub.server.updateDeckCount(roomCode, decks);
    }
    hub.client.sendUpdatedDeckCount = function (newCount) {
        if (playerInfo != null && playerInfo[0].playerName != playerName) {
            $('#decks').val(newCount);
        }
    }

    //Called on pushing READY - changes page element states and informs server
    imReady = function () {
        hub.server.playerReady(roomCode, playerName, true);
        ready = true;
        $('#setName').prop('disabled', true);
        $('#name').prop('disabled', true);
        $('#go').text("NOT READY");
        setDecksDDLEnablement(false);
    }
    //Called on pushing NOT READY - changes page element states back and informs
    //server
    imNotReady = function () {
        hub.server.playerReady(roomCode, playerName, false);
        ready = false;
        $('#setName').prop('disabled', false);
        $('#name').prop('disabled', false);
        $('#go').text("READY");
        setDecksDDLEnablement(true);
    }

    //Called when game starts - disables not ready button and shows message
    hub.client.start = function () {
        starting = true;
        $('#go').prop('disabled', true);
        message("Shuffling the deck...", false);
    }

    //Called when game is set up to trigger navigation to game
    hub.client.goToTable0 = function () {
        window.location.href = getBaseURL().concat('/Game/?roomCode=', roomCode, '&playerName=', playerName);
    }

    //----------- REJOIN ---------------

    hub.client.playersReady = function (players) {
        playerInfo = JSON.parse(players);

        notReadyCount = 0;
        lastNotReadyName = "";
        $('#rejoinPlayerList').empty();
        for (i = 0; i < playerInfo.length; i++) {
            if (!playerInfo[i].ready) {
                notReadyCount++;
                $('#rejoinPlayerList').append('<button>' + playerInfo[i].playerName + '</button>');
                lastNotReadyName = playerInfo[i].playerName;
            }
        }
        if (notReadyCount == 0) {
            window.location.href = getBaseURL().concat('/Start/?roomCode=', roomCode, '&message=This game is full.');
        }
        if (notReadyCount == 1) {
            window.location.href = getBaseURL().concat('/Game/?roomCode=', roomCode, '&playerName=', lastNotReadyName);
        }
        resize(window.innerWidth, window.innerHeight);
    }

    //----------- SHARED ---------------
    //Goes back to start screen
    backToStart = function () {
        screen = "start";
        $('#roomPane').addClass("hiddenPane");
        $('#rejoinPane').addClass("hiddenPane");
        $('#startPane').removeClass("hiddenPane");

        roomCode = "";
        playerName = "";
    }

    pushCurrentState = function () {
        history.pushState({ scrn: screen, rc: roomCode }, screen.charAt(0).toUpperCase().concat(screen.substring(1, screen.length)), window.location);
    }

    //Filter-down from window popstate event, which is bound to a method in the main layout.
    // This way, menu history items are handled first, then any others are passed downward to
    // the main pages.
    firePopstate = function (e) {
        if (e.state == null || e.state.screen == "start") { //Home screen
            location.reload();
            return;
        }
        //Room and rejoin screens
        // These will create history entries so that the back button works from them,
        // but they all just reload as the home screen.
        if (e.state.screen == "room" || e.state.screen == "rejoin") {
            location.reload();
        }
    };

    //Writes message to bottom of page
    message = function (text, isError) {
        messageDest = "#" + screen + "Message";
        if (isError) {
            $(messageDest).addClass("errorText");
        } else {
            $(messageDest).removeClass("errorText");
        }
        $(messageDest).text(text);
    }

    //General message text (not error)
    hub.client.receiveMessage = function (messageContents) {
        message(messageContents, false);
        console.log(messageContents);
    }

    //General error message text
    hub.client.errorMessage = function (theMessage) {
        message(theMessage, true);
        console.log(theMessage);
    }

    //Called on reconnected event - calls back to server with name
    hub.client.identify = function () {
        if (screen == "room") {
            hub.server.identify(playerName, roomCode);
        }
    }

    //Helper for URL construction
    getBaseURL = function () {
        pathArray = location.href.split('/');
        protocol = pathArray[0];
        host = pathArray[2];
        return protocol.concat('//', host);
    }

    //Reliably triggers OnDisconnected immediately when the page is left for any reason
    // Note: using hub.stop() (or $.connection.hub.stop()) doesn't work in all contexts
    window.onbeforeunload = function () {
        hub.server.stopConnection();
    }

    $.connection.hub.start().done(function () {
        $('#joinButton').click(function () {
            $()
            message("Finding game...", false);
            hub.server.clickJoin($('#roomCodeValue').val());
        });

        $('#newButton').click(function () {
            message("Making new game...", false);
            hub.server.newGame();
        });

        $('#setName').click(function () {
            newname = $('#name').val();
            if (newname == 'ok' || newname == '&') {
                message('Name cannot be "' + newname + '"', true);
            } else {
                message("Changing name...", false);
                hub.server.changeName(roomCode, $('#name').val());
            }
        });

        $('#go').click(function () {
            if (ready) {
                imNotReady();
            } else {
                imReady();
            }
        });

        $('#decks').change(function () {
            if (playerInfo != null && playerInfo[0].playerName == playerName) {
                updateDeckCount();
            }
        });

        $('#rejoinPlayerList').on('click', 'button', function () {
            window.location.href = getBaseURL().concat('/Game/?roomCode=', roomCode, '&playerName=', $(this).text());
        });

        $(".SJBody").show();
    });

    $(document).ready(function () {
        resize(window.innerWidth, window.innerHeight);

        $(window).resize(function () {
            resize(window.innerWidth, window.innerHeight);
        })
    });
});