$(function () {
    hub = $.connection.sixJuiceHub;
    screen = "start"; //changes to "room" or "rejoin"
    roomCode = "";
    playerName = "";
    playerInfo = null;
    ready = false;

    $('#setName').prop('disabled', false);
    $('#name').prop('disabled', false);
    $('#go').text("READY");
    $('#go').prop('disabled', false);

    //-------- SIZING --------------
    width = 0;      //Total width, set on window sizing events
    height = 0;     //Total height

    defaultMargin = 5;      //Default margin value to use in between elements
    minSideMargin = 20;     //Minimum margin on sides buffering the big buttons
    boxWidths = [          //Minimum and maximum widths:
        60, 400,                // Standard button
        60, 400,                // "SixJuice"
        45, 300,                // "Room Code:"
        45, 300,                // "<the room code>"
        60, 400,                // Player list
        45, 300                 // "Your Name:"
    ];
    boxHeights = [          //Minimum and maximum heights:
        15, 100,                // "Enter Room Code:"
        20, 160,                // "SixJuice"
        15, 100,                // "Room Code:"
        20, 160,                // "<the room code>"
        30, 1000,               // Player list (no max)
        15, 100                 // "Your Name:"
    ];
    enums = [
        "Button", //If you change the enum order, always leave this one first
        "SixJuice",
        "RoomCode",
        "RoomCodeValue",
        "PlayerList",
        "YourName"
    ];
    calcedWidths = [];
    calcedHeights = [];

    isPortrait = true;

    // Sizing event
    resize = function (wid, hei) {
        isPortrait = hei > wid;
        calcedWidths = [];
        calcedHeights = [];

        // Calculation of sizes
        enums.forEach(function (index, value) {
            wresult = 0;
            hresult = 0;
            switch (value) {
                case "Button":
                    wresult = (wid - 2 * minSideMargin) / (isPortrait ? 1 : 2) - (isPortrait ? 0 : defaultMargin);
                    hresult = hei / (isPortrait ? 5.0 : 3.0) - defaultMargin;
                    break;
                case "SixJuice":
                    wresult = wid - 2 * minSideMargin;
                    hresult = calcedHeights[0];
                    break;
                case "RoomCode":
                    wresult = calcedWidths[0] / 2;
                    hresult = calcedHeights[0] * 0.7;
                    break;
                case "RoomCodeValue":
                    wresult = calcedWidths[0] / 2;
                    hresult = calcedHeights[0] * 1.1;
                    break;
                case "PlayerList":
                    wresult = calcedWidths[0];
                    hresult = isPortrait ?
                        hei - calcedHeights[0] * 4.5 - defaultMargin * 7 :
                        hei - calcedHeights[0] * 1.1 - defaultMargin * 3;
                    break;
                case "YourName":
                    wresult = calcedWidths[0] / 2;
                    hresult = calcedHeights[0] * 0.7;
                    break;
            }
            calcedWidths.push(Math.min(Math.max(wresult, boxWidths[index * 2 + 1]), boxWidths[index * 2]));
            calcedHeights.push(hresult);
        });

        //Placing elements

    }
    //----------- START ----------------

    $('#roomCodeValue').focus();

    //Switches screen to Room, populates some page variables and objects, and joins game in server
    hub.client.goToRoomAs = function (destRoomCode, initPlayerName) {
        screen = "room";
        $('#startPane').addClass("hiddenPane");
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

        roomCode = destRoomCode;
        playerName = "";
        $('#rejoinRoomCode').text(roomCode);

        hub.server.rejoin(roomCode);
        history.pushState({ screen: "rejoin", rc: roomCode }, "Rejoin ".concat(roomCode), window.location);
    }

    //Room code validation
    oldtext = "";
    $('#roomCodeValue').on("change keyup paste", function () {
        text = $(this).val().toUpperCase();
        if (/^[A-Z0-9]{0,4}$/.test(text)) {
            $(this).val(text);
            oldtext = text;
        } else {
            $(this).val(oldtext);
        }
        $('#joinButton').prop('disabled', $(this).val().length != 4);
    });

    //------------ ROOM ----------------

    //Receives player updates
    hub.client.sendPlayerList = function (players) {
        playerInfo = JSON.parse(players);
        $('#roomPlayerList').empty();
        for (i = 0; i < playerInfo.length; i++) {
            $('#roomPlayerList').append('<div class="smallText">'.concat(playerInfo[i].playerName,
                (playerInfo[i].ready ? " - READY" : ""), '</div>'));
        }
        message("", false);
    }

    //Callback for validation of name change
    hub.client.nameChangeCallback = function (name, fail) {
        if (fail) {
            message("The name ".concat(name, " is already taken."), true);
        } else {
            playerName = name;
        }
    }

    //Called on pushing READY - changes page element states and informs server
    imReady = function () {
        hub.server.playerReady(roomCode, playerName, true);
        ready = true;
        $('#setName').prop('disabled', true);
        $('#name').prop('disabled', true);
        $('#go').text("NOT READY");
    }
    //Called on pushing NOT READY - changes page element states back and informs
    //server
    imNotReady = function () {
        hub.server.playerReady(roomCode, playerName, false);
        ready = false;
        $('#setName').prop('disabled', false);
        $('#name').prop('disabled', false);
        $('#go').text("READY");
    }

    //Called when game starts - disables not ready button and shows message
    hub.client.start = function () {
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
                $('#rejoinPlayerList').append('<div><span class="sidepad"></span><button class="medText sidepadsandwich rejoinButton">'.concat(playerInfo[i].playerName, '</button></div>'));
                lastNotReadyName = playerInfo[i].playerName;
            }
        }
        if (notReadyCount == 0) {
            window.location.href = getBaseURL().concat('/Start/?roomCode=', roomCode, '&message=This game is full.');
        }
        if (notReadyCount == 1) {
            //hub.server.createConnectedPlayer(lastNotReadyName, roomCode);
            window.location.href = getBaseURL().concat('/Game/?roomCode=', roomCode, '&playerName=', lastNotReadyName);
        }
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
        messageDest = "#roomMessage";
        if (screen == "start") {
            messageDest = "#startMessage";
        }
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
            message("Changing name...", false);
            hub.server.changeName(roomCode, $('#name').val());
        });

        $('#go').click(function () {
            if (ready) {
                imNotReady();
            } else {
                imReady();
            }
        });

        $('#rejoinPlayerList').on('click', '.rejoinButton', function () {
            window.location.href = getBaseURL().concat('/Game/?roomCode=', roomCode, '&playerName=', $(this).text());
        });

        $(".SJBody").show();
    });
});