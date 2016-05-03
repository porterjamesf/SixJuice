﻿using MongoDB.Bson;
using MongoDB.Driver;
using SixJuice.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web;

namespace SixJuice.Database
{
    public class MongoDBHelper : IDatabaseHelper
    {
        public IMongoDatabase _db;

        public IMongoCollection<Game> games
        {
            get
            {
                return _db.GetCollection<Game>("games");
            }
        }
        public IMongoCollection<ConnectedPlayer> connectedPlayers
        {
            get
            {
                return _db.GetCollection<ConnectedPlayer>("connectedPlayers");
            }
        }

        public MongoDBHelper ()
        {
            _db = (new MongoClient(Properties.Settings.Default.connectionString)).GetDatabase("Sixjuice");
        }

        // Helper for game finding filter
        private FilterDefinition<Game> getFilter(string roomCode)
        {
            return Builders<Game>.Filter.Eq("RoomCode", roomCode);
        }

        public async Task<string> CreateGame()
        {
            //Generation of unique room code
            var roomCodes = games.Find(new BsonDocument()).ToList().Select(g => g.RoomCode);
            var rc = new char[4];
            var roomCode = "";
            var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            var rand = new Random();
            do
            {
                for (int i = 0; i < 4; i++)
                {
                    rc[i] = chars[rand.Next(chars.Length)];
                }
                roomCode = new string(rc);
            } while (roomCodes.Contains(roomCode));

            //Add new game to database
            Game gameToAdd = new Game
            {
                RoomCode = roomCode,
                Table = new List<Card>(),
                Deck = new List<Card>(),
                Players = new List<Player>(),
                Turn = -1,
                DeckCount = 1
            };
            await games.InsertOneAsync(gameToAdd);

            return roomCode;
        }

        public async Task<Game> GetGame(string roomCode)
        {
            var result = (await games.FindAsync(getFilter(roomCode))).ToList();
            if(result.Count == 0)
            {
                throw new NoSuchGameException("There is no game with room code " + roomCode);
            }
            if(result.Count > 1)
            {
                throw new DuplicateGameException("There are multiple open games with room code " + roomCode);
            }
            return result.Single();
        }

        public async Task DeleteGame(string roomCode)
        {
            await games.DeleteOneAsync(getFilter(roomCode));
        }
        public async Task RemoveEmptyGame(string roomCode)
        {
            var builder = Builders<Game>.Filter;
            var filter = builder.Eq("RoomCode", roomCode) & builder.Size("Players", 0) & builder.Eq("Turn", -1);
            await games.DeleteOneAsync(filter);
        }

        public async Task SaveGame(string roomCode, Game game)
        {
            await update(game);
        }

        public async Task AddPlayer(string roomCode, string playerName)
        {
            Player player = new Player
            {
                Ready = false,
                Name = playerName,
                PointCards = new List<Card>(),
                NormalCards = new List<Card>(),
                Hand = new List<Card>(),
                Kings = new List<List<Card>>()
            };
            var update = Builders<Game>.Update.Push("Players", player);
            var result = await games.UpdateOneAsync(getFilter(roomCode), update);
            if(!result.IsAcknowledged || result.MatchedCount == 0)
            {
                throw new NoSuchGameException("Could not update game with room code " + roomCode);
            }
        }

        public async Task RemovePlayer(string roomCode, string playerName)
        {
            var builder = Builders<Game>.Filter;
            var filter = builder.Eq("RoomCode", roomCode) & builder.Eq("Turn", -1);
            var update = Builders<Game>.Update.PullFilter("Players", Builders<Player>.Filter.Eq("Name", playerName));
            await games.UpdateOneAsync(filter, update);
        }

        public async Task<List<PlayerViewModel>> GetPlayerList(string roomCode)
        {
            return (await GetGame(roomCode)).Players.Select(p =>
            {
                return new PlayerViewModel
                {
                    playerName = p.Name,
                    ready = p.Ready
                };
            }).ToList();
        }

        //Simply replaces the game in database
        private async Task update(Game update)
        {
            var filter = Builders<Game>.Filter.Eq("RoomCode", update.RoomCode);
            await games.ReplaceOneAsync(filter, update);
        }

        //Updates a player's ready status and returns info for the whole group
        public async Task<List<PlayerViewModel>> PlayerReady(string roomCode, string playerName, bool isReady)
        {
            var builder = Builders<Game>.Filter;
            var filter = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            var update = Builders<Game>.Update.Set("Players.$.Ready", isReady);
            await games.UpdateOneAsync(filter, update);
            return await GetPlayerList(roomCode);
        }

        #region Game Play

        //Updates the value of Turn and draws cards for new active player
        public async Task<NewTurn> SetTurn(string roomCode, int value)
        {
            var game = await GetGame(roomCode);
            var update = Builders<Game>.Update.Set("Turn", value);
            NewTurn newTurn = new NewTurn
            {
                nextPlayerName = game.Players[value].Name,
                drawnCards = new List<Card>()
            };
            if (game.Turn != -1)
            {
                int cardsToDraw = 4 - game.Players[value].Hand.Count;
                for (int i = 0; i < cardsToDraw; i++)
                {
                    if (i < game.Deck.Count)
                    {
                        Card card = game.Deck.ElementAt(i);
                        update = update.Pull("Deck", card).Push("Players." + value + ".Hand", card);
                        newTurn.drawnCards.Add(card);
                    }
                }
            }
            await games.UpdateOneAsync(getFilter(roomCode), update);
            return newTurn;
        }

        //var update = Builders<Game>.Update.PullFilter("Players", Builders<Player>.Filter.Eq("Name", playerName));

        //Performs card move, turn update, and draws cards for next player
        public async Task<NewTurn> Discard(string roomCode, string playerName, Card discard)
        {
            var game = await GetGame(roomCode);
            //Moving discarded card from player's hand
            var builder = Builders<Game>.Filter;
            var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            var updateThisPlayerHand = Builders<Game>.Update.Pull("Players.$.Hand", discard);
            //BsonDocument.Parse("{ number : " + discard.number + ", suit : \"" + discard.suit + "\"}")

            //Moving discarded card to table and changing turn to next player's turn
            int nextPlayer = (game.Turn + 1) % game.Players.Count;
            var update = Builders<Game>.Update.Set("Turn", nextPlayer).Push("Table", discard);
            NewTurn newTurn = new NewTurn
            {
                nextPlayerName = game.Players[nextPlayer].Name,
                drawnCards = new List<Card>()
            };
            //Drawing new cards
            int cardsToDraw = 4 - game.Players[nextPlayer].Hand.Count;
            var filterNextPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", newTurn.nextPlayerName);
            UpdateDefinition<Game> updateNextPlayerHand = null;
            for (int i = 0; i < cardsToDraw; i++)
            {
                if (i < game.Deck.Count)
                {
                    Card card = game.Deck.ElementAt(i);
                    update = update.Pull("Deck", card);
                    newTurn.drawnCards.Add(card);
                    if(updateNextPlayerHand == null)
                    {
                        updateNextPlayerHand = Builders<Game>.Update.Push("Players.$.Hand", card);
                    } else
                    {
                        updateNextPlayerHand = updateNextPlayerHand.Push("Players.$.Hand", card);
                    }
                }
            }
            await games.UpdateOneAsync(getFilter(roomCode), update);
            await games.UpdateOneAsync(filterThisPlayer, updateThisPlayerHand);
            if(updateNextPlayerHand != null)
            {
                await games.UpdateOneAsync(filterNextPlayer, updateNextPlayerHand);
            }
            return newTurn;
        }

        public async Task Take(string roomCode, string playerName, List<Card> fromHand, List<Card> fromTable) { }

        public async Task PlayKing(string roomCode, string playerName, Card king) { }

        public async Task PlayQueen(string roomCode, string playerName, Card queen) { }

        public async Task PlayJackOfClubs(string roomCode, string playerName, string queenPlayerName, Card queen) { }

        public async Task PlayJackOfSpades(string roomCode, string playerName, string victimName) { }

        public async Task UseForKing(string roomCode, string playerName, string source, List<List<Card>> cards, List<Card> kings) { }

        #endregion

        #region Connection Management


        public async Task AddConnectedPlayer(string connectionId, string playerName, string roomCode, string screen)
        {
            await connectedPlayers.InsertOneAsync(new ConnectedPlayer
            {
                ConnectionId = connectionId,
                PlayerName = playerName,
                RoomCode = roomCode,
                Screen = screen
            });
        }

        private FilterDefinition<ConnectedPlayer> getCPFbyId(string connectionId)
        {
            return Builders<ConnectedPlayer>.Filter.Eq("ConnectionId", connectionId);
        }

        private FilterDefinition<ConnectedPlayer> getCPFbyName(string playerName, string roomCode)
        {
            var builder = Builders<ConnectedPlayer>.Filter;
            return builder.Eq("PlayerName", playerName) & builder.Eq("RoomCode", roomCode);
        }

        private FilterDefinition<ConnectedPlayer> getCPFbyRoom(string roomCode)
        {
            return Builders<ConnectedPlayer>.Filter.Eq("RoomCode", roomCode);
        }

        public async Task<ConnectedPlayer> GetConnectedPlayer(string connectionId)
        {
            var result = (await connectedPlayers.FindAsync(getCPFbyId(connectionId))).ToList();
            if (result.Count > 1)
            {
                throw new DuplicatePlayerException("This connectionId is registered for multiple connections");
            }
            if (result.Count == 0)
            {
                throw new NoSuchPlayerException("There are no connections with this connectionId");
            }
            return result.Single();
        }

        public async Task<string> GetConnectedPlayerId(string roomCode, string playerName)
        {
            var result = (await connectedPlayers.FindAsync(getCPFbyName(playerName, roomCode))).ToList();
            if (result.Count > 1)
            {
                throw new DuplicatePlayerException("This connectionId is registered for multiple connections");
            }
            if (result.Count == 0)
            {
                throw new NoSuchPlayerException("There are no connections with this connectionId");
            }
            return result.Single().ConnectionId;
        }

        public async Task<List<ConnectedPlayer>> GetConnectedPlayers(string roomCode)
        {
            return (await connectedPlayers.FindAsync(getCPFbyRoom(roomCode))).ToList();
        }

        private async Task update(ConnectedPlayer player, string roomCode = null)
        {
            FilterDefinition<ConnectedPlayer> filter = null;
            if (roomCode == null)
            {
                filter = Builders<ConnectedPlayer>.Filter.Eq("ConnectionId", player.ConnectionId);
            } else
            {
                var builder = Builders<ConnectedPlayer>.Filter;
                filter = builder.Eq("PlayerName", player.PlayerName) & builder.Eq("RoomCode", roomCode);
            }
            await connectedPlayers.ReplaceOneAsync(filter, player);
        }
        public async Task RemoveConnectedPlayer(string connectionId)
        {
            await connectedPlayers.DeleteOneAsync(getCPFbyId(connectionId));
        }
        public async Task ChangePlayerName(string connectionId, string newPlayerName)
        { //Note: this method contains 2 operations - each is atomic, but the pair is not
            var update = Builders<ConnectedPlayer>.Update.Set("PlayerName", newPlayerName);
            var oldPlayer = await connectedPlayers.FindOneAndUpdateAsync(getCPFbyId(connectionId), update);
            var builder = Builders<Game>.Filter;
            var filter = builder.Eq("RoomCode", oldPlayer.RoomCode) & builder.Eq("Players.Name", oldPlayer.PlayerName);
            var gameUpdate = Builders<Game>.Update.Set("Players.$.Name", newPlayerName);
            await games.UpdateOneAsync(filter, gameUpdate);
        }
        public async Task ChangePlayerConnectionId(string playerName, string roomCode, string newConnectionId)
        {
            var update = Builders<ConnectedPlayer>.Update.Set("ConnectionId", newConnectionId);
            await connectedPlayers.UpdateOneAsync(getCPFbyName(playerName, roomCode), update);
        }
        public async Task ChangePlayerScreen(string playerName, string roomCode, string newScreen)
        {
            var update = Builders<ConnectedPlayer>.Update.Set("Screen", newScreen);
            await connectedPlayers.UpdateOneAsync(getCPFbyName(playerName, roomCode), update);
        }

        //public async Task<string> GetPlayerScreen(string playerName, string roomCode)
        //{
        //    return (await connectedPlayers.FindAsync(getCPFbyName(playerName, roomCode))).Single().Screen;
        //}

        #endregion

        public class NoSuchGameException : Exception
        {
            public NoSuchGameException(string message) : base(message) { }
        }

        public class DuplicateGameException : Exception
        {
            public DuplicateGameException(string message) : base(message) { }
        }

        public class NoSuchPlayerException : Exception
        {
            public NoSuchPlayerException(string message) : base(message) { }
        }

        public class DuplicatePlayerException : Exception
        {
            public DuplicatePlayerException(string message) : base(message) { }
        }
    }
}