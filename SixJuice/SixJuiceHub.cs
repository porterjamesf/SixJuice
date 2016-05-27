using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.AspNet.SignalR;
using System.Threading.Tasks;
using SixJuice.Database;
using SixJuice.Models;
using Newtonsoft.Json;
using System.Threading;

namespace SixJuice
{

    public class SixJuiceHub : Hub
    {
        public static IDatabaseHelper _db = new MongoDBHelper();

        //From Index
        public async Task NewGame()
        {
            var roomCode = await _db.CreateGame();
            Clients.Caller.goToRoomAs(roomCode, "Player1");
        }

        //From Index - Finds game. If game hasn't started, this simply
        // checks what player name to assign and does callback to
        // trigger navigation to Room
        // If game has started and there are missing players, triggers
        // nagivation to screen to select player to be.
        // If game has started and there are no missing players, displays
        // error.
        public async Task ClickJoin(string roomCode)
        {
            try {
                Game game = await _db.GetGame(roomCode);
                if (game.Turn == -1)
                {
                    var playerList = game.Players.Select(p => p.Name);
                    int i = 1;
                    string name = "Player1";
                    while (playerList.Contains(name))
                    {
                        i++;
                        name = "Player" + i;
                    }
                    Clients.Caller.goToRoomAs(roomCode, name);
                    return;
                }
                List<Player> missingPlayers = game.Players.Where(p => !p.Ready).ToList();
                if (missingPlayers.Count == 0)
                {
                    Clients.Caller.errorMessage("This game is full.");
                    return;
                }
                Clients.Caller.goToRejoin(roomCode);
            } catch (MongoDBHelper.NoSuchGameException)
            {
                Clients.Caller.errorMessage("No room exists with this code.");
            } catch (MongoDBHelper.DuplicateGameException)
            {
                Clients.Caller.errorMessage("There was an unexpected problem with this game.");
            }
        }

        //From Room - broadcasts a message to other players in room - for debugging
        public void sendOutMessage(string roomCode, string message)
        {
            Clients.Group(roomCode).receiveMessage(message);
        }

        //From Room - Initial join, sets up player in db
        public async Task JoinRoomAs(string roomCode, string playerName)
        {
            try {
                await _db.AddPlayer(roomCode, playerName);
                await _db.AddConnectedPlayer(Context.ConnectionId, playerName, roomCode, "Room");

                await Groups.Add(Context.ConnectionId, roomCode);
                Clients.Group(roomCode).sendPlayerList(JsonConvert.SerializeObject(await _db.GetPlayerList(roomCode, playerName)));
            } catch (MongoDBHelper.NoSuchGameException)
            {
                Clients.Caller.cancelJoinRoom();
            }
        }

        //From Room
        public async Task ChangeName(string roomCode, string newName)
        {
            //Validation
            var fail = (await _db.GetPlayerList(roomCode, newName)).Select(p => p.playerName).ToList().Contains(newName);
            Clients.Caller.nameChangeCallback(newName, fail);
            if(!fail)
            {
                //Name change
                await _db.ChangePlayerName(Context.ConnectionId, newName);
                Clients.Group(roomCode).sendPlayerList(JsonConvert.SerializeObject(await _db.GetPlayerList(roomCode, newName)));
            }
        }

        //From Room - In addition to setting player ready status and notifying group,
        // also checks if everyone's ready and starts game if so
        public async Task PlayerReady(string roomCode, string playerName, bool isReady)
        {
            List<PlayerViewModel> players = await _db.PlayerReady(roomCode, playerName, isReady);
            Clients.Group(roomCode).sendPlayerList(JsonConvert.SerializeObject(players));

            if(players.Count <= 1)
            {
                return;
            }
            foreach(PlayerViewModel player in players)
            {
                if(!player.ready)
                {
                    return;
                }
            }

            //All players ready
            Clients.Group(roomCode).start();
            await StartAGame(roomCode);
        }

        //From this.PlayerReady, from Room - Distrubutes cards and does callback to
        // trigger navigation into Game
        private async Task StartAGame(string roomCode)
        {
            //First, update turn to 0 to indicate game has started and prevent it from being
            // deleted when all the players disconnect from the waiting room
            await _db.SetTurn(roomCode, 0);

            //Make the deck
            Game game = await _db.GetGame(roomCode);
            string[] suits = { "hearts", "diamonds", "clubs", "spades" };
            for (int d = 0; d < game.DeckCount; d++)
            {
                for (int s = 0; s < 4; s++)
                {
                    for (int n = 1; n <= 13; n++)
                    {
                        game.Deck.Add(new Card
                        {
                            suit = suits[s],
                            number = n
                        });
                    }
                }
            }
            //Shuffle the cards
            Random rand = new Random(Environment.TickCount);
            for (int i = game.Deck.Count - 1; i >= 0; i--)
            {
                int swap = rand.Next(i + 1);
                Card swapCard = game.Deck[swap];
                game.Deck[swap] = game.Deck[i];
                game.Deck[i] = swapCard;
            }
            //Deal and reset ready status - Ready is now used to track players' connections to the room
            foreach (Player player in game.Players)
            {
                player.Hand = draw(game.Deck, 4);
                player.Ready = false;
            }
            game.Table = draw(game.Deck, 4);
            //Populate the first KSources
            game.Players[0].KSources = new List<List<Card>>();
            game.Players[0].KSources.Add(game.Players[0].Hand);
            game.Players[0].KSources.Add(game.Table);

            //Save state
            await _db.SaveGame(roomCode, game);

            //Ready to begin!
            Clients.Group(roomCode).goToTable0();
        }

        //From Rejoin - Puts connection into listening group for player updates and triggers
        // callback with list of missing players
        public async Task Rejoin(string roomCode)
        {
            await Groups.Add(Context.ConnectionId, roomCode);
            Clients.Caller.playersReady(JsonConvert.SerializeObject(await _db.GetPlayerList(roomCode, "")));
        }

        //From Rejoin - Adds a connected player for the newly joining connection
        public async Task CreateConnectedPlayer(string playerName, string roomCode)
        {
            await _db.AddConnectedPlayer(Context.ConnectionId, playerName, roomCode, "Transition");
        }

        //From Game - Checks that the player trying to join the game room is not alreay present playing the game
        // (this is what guards against url tinkering to break the site)
        public async Task ConfirmId(string roomCode, string playerName)
        {
            var player = (await _db.GetPlayerList(roomCode, playerName)).Where(p => p.playerName.Equals(playerName));
            bool result = false;
            if(player.Count() == 1)
            {
                result = !player.Single().ready;
            }
            Clients.Caller.idConfirm(result);
        }

        //From Game - Updates game in db to show player ready, and updates player in db to have
        // Game screen. Also adds to group.
        public async Task JoinGameAs(string roomCode, string playerName)
        {
            await _db.AddConnectedPlayer(Context.ConnectionId, playerName, roomCode, "Game");
            //await _db.ChangePlayerScreen(playerName, roomCode, "Game");
            await Groups.Add(Context.ConnectionId, roomCode);
            List<PlayerViewModel> players = await _db.PlayerReady(roomCode, playerName, true);
            Clients.Group(roomCode).playersReady(JsonConvert.SerializeObject(players));
        }

        //From Game - Gets the game info for a player
        public async Task GetPlayerGameState(string roomCode, string playerName)
        {
            Game game = await _db.GetGame(roomCode);
            Player thisPlayer = game.Players.Where(p => p.Name.Equals(playerName)).Single();
            List<Player> otherPlayers = game.Players.Where(p => !p.Name.Equals(playerName)).ToList();
            PlayerGameState pgs = new PlayerGameState
            {
                DeckCount = game.Deck.Count,
                Table = game.Table,
                WhosTurn = game.Players[game.Turn].Name,
                GameOver = game.Results,
                Hand = thisPlayer.Hand,
                Kings = thisPlayer.Kings,
                KSources = thisPlayer.KSources,
                PointCardCount = thisPlayer.PointCards.Count,
                NormalCards = new FacingDeck
                {
                    Count = thisPlayer.NormalCards.Count,
                    Top = (thisPlayer.NormalCards.Count > 0? thisPlayer.NormalCards.ElementAt(thisPlayer.NormalCards.Count - 1):null)
                },
                OtherPlayers = new List<OtherPlayerState>()
            };
            foreach(Player player in otherPlayers)
            {
                pgs.OtherPlayers.Add(new OtherPlayerState
                {
                    PlayerName = player.Name,
                    HandCount = player.Hand.Count,
                    Kings = player.Kings,
                    PointCardCount = player.PointCards.Count,
                    NormalCards = new FacingDeck
                    {
                        Count = player.NormalCards.Count,
                        Top = (player.NormalCards.Count > 0?player.NormalCards.ElementAt(player.NormalCards.Count - 1):null)
                    }
                });
            }
            Clients.Caller.receivePlayerGameState(JsonConvert.SerializeObject(pgs));
        }

        //From Game - posts an in-game action from active player and sends game stat updates to all players
        public async Task GameAction(string roomCode, string jsonAction)
        {
            Console.Out.WriteLine("Test");
            GameAction result = JsonConvert.DeserializeObject<GameAction>(jsonAction);
            switch(result.action)
            {
                case "take":
                    await _db.Take(roomCode, result.playerName, result.hand, result.table);
                    Clients.Group(roomCode).receivePlayerGameAction(jsonAction);
                    break;
                case "ask":
                    Game game = await _db.GetGame(roomCode);
                    var matches = new List<Card>();
                    var neededNumbers = result.hand.Select(c => c.number).ToList();
                    foreach(Card card in game.Players.Where(p => p.Name.Equals(result.misc)).Single().Hand)
                    {
                        if(neededNumbers.Contains(card.number))
                        {
                            if(card.number == 11 && (card.suit.Equals("spades") || card.suit.Equals("clubs")))
                            {
                                continue;
                            }
                            matches.Add(card);
                            neededNumbers.Remove(card.number);
                        }
                    }
                    if(matches.Count == 0)
                    {
                        Clients.Caller.nothingFrom(result.misc);
                        break;
                    }
                    Card[] copydest = new Card[matches.Count];
                    matches.CopyTo(copydest);
                    result.hand = copydest.ToList();
                    await _db.UseForKing(roomCode, result.playerName, result.misc, matches);
                    result.action = "u4K";
                    Clients.Group(roomCode).receivePlayerGameAction(JsonConvert.SerializeObject(result));
                    break;
                case "useK":
                    await _db.PlayKings(roomCode, result.playerName, result.hand);
                    Clients.Group(roomCode).receivePlayerGameAction(jsonAction);
                    break;
                case "u4K":
                    await _db.UseForKing(roomCode, result.playerName, result.misc, result.hand);
                    Clients.Group(roomCode).receivePlayerGameAction(jsonAction);
                    break;
                case "useQ":
                    Clients.Group(roomCode).qcd(jsonAction);
                    break;
                case "endQ":
                    if (result.misc != null)
                    {
                        await _db.PlayJackOfClubs(roomCode, result.playerName, result.misc, result.hand.ElementAt(0), result.table);
                    }
                    else
                    {
                        await _db.PlayQueen(roomCode, result.playerName, result.hand.ElementAt(0), result.table);
                    }
                    Clients.Group(roomCode).receivePlayerGameAction(jsonAction);
                    break;
                case "useJ":
                    await _db.PlayJackOfSpades(roomCode, result.playerName, result.misc);
                    Clients.Group(roomCode).receivePlayerGameAction(jsonAction);
                    break;
                case "discard":
                    //result contains: name, "discard", hand=discarded card, null, null
                    NewTurn newTurn = await _db.Discard(roomCode, result.playerName, (result.hand == null? null : result.hand.ElementAt(0)));
                    
                    var players = await _db.GetConnectedPlayers(roomCode);
                    foreach(ConnectedPlayer player in players)
                    {
                        GameAction playerGameAction = clone(result);
                        playerGameAction.table = new List<Card>();
                        if(player.PlayerName.Equals(newTurn.nextPlayerName))
                        { //Next player - game action table contains drawn cards
                            foreach(Card card in newTurn.drawnCards)
                            {
                                playerGameAction.table.Add(card);
                            }
                        } else
                        { //Other players (including this player) - game action table contains just placeholders
                            foreach (Card card in newTurn.drawnCards)
                            {
                                playerGameAction.table.Add(new Card());
                            }
                        }
                        playerGameAction.misc = newTurn.nextPlayerName;
                        Clients.Client(player.ConnectionId).receivePlayerGameAction(JsonConvert.SerializeObject(playerGameAction));
                    }
                    break;

                default:
                    break;
            }
        }

        //From Game: passes on the message that a given player OK's the use of a queen. Message is then sent to the
        // queen player.
        public async Task okQueen(string roomCode, string playerName)
        {
            Game game = await _db.GetGame(roomCode);
            string conId = await _db.GetConnectedPlayerId(roomCode, game.Players.ElementAt(game.Turn).Name);
            Clients.Client(conId).okQueen(playerName);
        }

        //From Game: Broadcasts resQ messages to all clients (for resuming queen count down after reconnection)
        public void resQ(string roomCode, int count, Card queen, string queenPlayer, List<string> nonOkd)
        {
            Clients.Group(roomCode).resQ(count, queen, queenPlayer, nonOkd);
        }

        //From Game: Registers a player as being done and passes to the next player. Also detects end of game
        public async Task imDone(string roomCode, string playerNom)
        {
            Results result = await _db.PlayerDone(roomCode, playerNom);
            if (result == null)
            {
                //Same as End Turn (a blank Discard event)
                await GameAction(roomCode, JsonConvert.SerializeObject(new GameAction
                {
                    action = "discard",
                    hand = null,
                    table = null,
                    misc = null,
                    playerName = playerNom
                }));
            } else
            {
                Clients.Group(roomCode).gameOver(JsonConvert.SerializeObject(result));
            }
        }

        //Helper for cloning game actions. Note: shallow cloning - card lists point to same lists
        public GameAction clone(GameAction action)
        {
            return new GameAction
            {
                playerName = action.playerName,
                action = action.action,
                hand = action.hand,
                table = action.table,
                misc = action.misc
            };
        }

        //Another way of triggering OnDisconnected, since hub.stop() or $.connection.hub.stop() don't
        // always happen correctly depending on context
        public async Task stopConnection()
        {
            await OnDisconnected(true);
        }
        public override async Task OnDisconnected(bool stopCalled)
        {
            try {
                ConnectedPlayer player = await _db.GetConnectedPlayer(Context.ConnectionId);
                if(player.Screen.Equals("Room"))
                {
                    await _db.RemoveConnectedPlayer(Context.ConnectionId);
                    await _db.RemovePlayer(player.RoomCode, player.PlayerName);
                    Clients.Group(player.RoomCode).sendPlayerList(JsonConvert.SerializeObject(await _db.GetPlayerList(player.RoomCode, player.PlayerName)));

                    //Deletion of empty game
                    await _db.RemoveEmptyGame(player.RoomCode);
                }
                if(player.Screen.Equals("Game"))
                {
                    await _db.RemoveConnectedPlayer(Context.ConnectionId);
                    Clients.Group(player.RoomCode).playersReady(JsonConvert.SerializeObject(await _db.PlayerReady(player.RoomCode, player.PlayerName, false)));
                }
            }
            catch (MongoDBHelper.NoSuchPlayerException)
            { //(May occur because of repeated calls in some cases, or in disconnects from start/rejoin)
                return;
            }
            await base.OnDisconnected(stopCalled);
        }

        // Triggers client call to identify itself
        public override async Task OnReconnected()
        {
            Clients.Client(Context.ConnectionId).identify();
            await base.OnReconnected();
        }

        // Called from client methods in response to reconnect - updates connectionID and re-adds to group
        public async Task Identify(string playerName, string roomCode)
        {
            await _db.ChangePlayerConnectionId(playerName, roomCode, Context.ConnectionId);
            await Groups.Add(Context.ConnectionId, roomCode);
        }

        //Helper
        private static List<Card> draw (List<Card> deck, int number)
        {
            List<Card> drawn = new List<Card>();
            for(int i = 0; i < number; i++)
            {
                if (deck.Count > 0)
                {
                    drawn.Add(deck[0]);
                    deck.RemoveAt(0);
                }
            }
            return drawn;
        }
    }
}