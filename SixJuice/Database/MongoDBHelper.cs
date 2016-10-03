using MongoDB.Bson;
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

        public TimeSpan expirePeriod = TimeSpan.FromHours(2);
        //NOTE: if you change the expire time, make sure to drop the old index from the existing database manually using db.games.dropIndex("DateCreated_-1")
        // The new index will be created automatically, but only if no index exists on that field

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

        public MongoDBHelper()
        {
            _db = (new MongoClient(Properties.Settings.Default.connectionString)).GetDatabase("Sixjuice");

            // Checks if the expire period on the date created index has been changed. If so, drops the index and creates a new one with the updated expire period
            if (!TimeSpan.FromSeconds(games.Indexes.List().ToList().Where(i => i.Values.ElementAt(2).AsString.Equals("DateCreated_-1")).Single().Values.ElementAt(4).AsDouble).Equals(expirePeriod))
            {
                games.Indexes.DropOneAsync("DateCreated_-1");
                games.Indexes.CreateOneAsync(Builders<Game>.IndexKeys.Descending("DateCreated"), new CreateIndexOptions
                {
                    ExpireAfter = expirePeriod
                });
            }
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
                DateCreated = DateTime.UtcNow,
                RoomCode = roomCode,
                Table = new List<Card>(),
                Deck = new List<Card>(),
                Players = new List<Player>(),
                Turn = -1,
                DeckCount = 1,
                Results = null
            };
            await games.InsertOneAsync(gameToAdd);

            return roomCode;
        }

        public async Task<Game> GetGame(string roomCode)
        {
            var result = (await games.FindAsync(getFilter(roomCode))).ToList();
            if (result.Count == 0)
            {
                throw new NoSuchGameException("There is no game with room code " + roomCode);
            }
            if (result.Count > 1)
            {
                throw new DuplicateGameException("There are multiple open games with room code " + roomCode);
            }
            return result.Single();
        }

        public async Task DeleteGame(string roomCode)
        {
            // Deletes game by setting is DateCreated field to a time such that its expiration will arrive in 2 minutes.
            // This way, it's still around for a moment if players want to go back to check the scores, but will disappear shortly.
            var expireUpdate = Builders<Game>.Update.Set("DateCreated", DateTime.UtcNow.Subtract(expirePeriod).Add(TimeSpan.FromMinutes(2)));
            await games.UpdateOneAsync(getFilter(roomCode), expireUpdate);
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
                Name = playerName,
                Ready = false,
                Done = false,
                PointCards = new List<Card>(),
                NormalCards = new List<Card>(),
                Hand = new List<Card>(),
                Kings = new List<List<Card>>(),
                KSources = new List<List<Card>>()
            };
            var update = Builders<Game>.Update.Push("Players", player);
            var result = await games.UpdateOneAsync(getFilter(roomCode), update);
            if (!result.IsAcknowledged || result.MatchedCount == 0)
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

		public async Task UpdateDeckCount(string roomCode, int deckCount)
		{
			var update = Builders<Game>.Update.Set("DeckCount", deckCount);
			await games.UpdateOneAsync(getFilter(roomCode), update);
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

        //Updates the value of Turn 
        public async Task SetTurn(string roomCode, int value)
        {
            var game = await GetGame(roomCode);
            var update = Builders<Game>.Update.Set("Turn", value);
            await games.UpdateOneAsync(getFilter(roomCode), update);
        }

        //Performs card move, turn update, and draws cards for next player
        public async Task<NewTurn> Discard(string roomCode, string playerName, Card discard)
        {
            var game = await GetGame(roomCode);
            //Moving discarded card from player's hand
            var builder = Builders<Game>.Filter;
            var filterThisPlayer = discard != null ? builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName) : null;
            var updateThisPlayerHand = discard != null ? Builders<Game>.Update.Pull("Players.$.Hand", discard) : null;

            //Moving discarded card to table and changing turn to next player's turn
            int nextPlayer = (game.Turn + 1) % game.Players.Count;
            List<UpdateDefinition<Game>> gameUpdates = new List<UpdateDefinition<Game>>();
            gameUpdates.Add(Builders<Game>.Update.Set("Turn", nextPlayer));
            if (discard != null)
            {
                gameUpdates.Add(Builders<Game>.Update.Push("Table", discard));
                game.Table.Add(discard); //Just for the kSources
            }
            NewTurn newTurn = new NewTurn
            {
                nextPlayerName = game.Players[nextPlayer].Name,
                drawnCards = new List<Card>()
            };
            //Drawing new cards
            int cardsToDraw = 4 - game.Players[nextPlayer].Hand.Count;
            var filterNextPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", newTurn.nextPlayerName);
            List<UpdateDefinition<Game>> nextPlayerHandUpdates = new List<UpdateDefinition<Game>>();
            for (int i = 0; i < cardsToDraw; i++)
            {
                if (i < game.Deck.Count)
                {
                    Card card = game.Deck.ElementAt(i);
                    gameUpdates.Add(Builders<Game>.Update.Pull("Deck", card));
                    newTurn.drawnCards.Add(card);
                    nextPlayerHandUpdates.Add(Builders<Game>.Update.Push("Players.$.Hand", card));
                    game.Players[nextPlayer].Hand.Add(card); //Just for the kSources
                }
            }
            //Finding kSources
            var kings = game.Players[nextPlayer].Kings;
            var kSources = new List<List<Card>>();
            kSources.Add(game.Players[nextPlayer].Hand);
            kSources.Add(game.Table);
            nextPlayerHandUpdates.Add(Builders<Game>.Update.Set("Players.$.KSources", kSources));
            //DB
            if (discard != null)
            {
                await games.UpdateOneAsync(filterThisPlayer, updateThisPlayerHand);
            }
            var roomFilter = getFilter(roomCode);
            foreach(UpdateDefinition<Game> update in gameUpdates)
            {
                await games.UpdateOneAsync(roomFilter, update);
            }
            foreach(UpdateDefinition<Game> update in nextPlayerHandUpdates)
            {
                await games.UpdateOneAsync(filterNextPlayer, update);
            }
            return newTurn;
        }

        public async Task Take(string roomCode, string playerName, List<Card> fromHand, List<Card> fromTable) {
            List<Card> collectedCards = new List<Card>();
            //Removing cards from table
            List<UpdateDefinition<Game>> tableUpdates = new List<UpdateDefinition<Game>>();
            for (int i = 0; i < fromTable.Count; i++)
            {
                Card card = fromTable.ElementAt(i);
                collectedCards.Add(card);
                tableUpdates.Add(Builders<Game>.Update.Pull("Table", card));
            }
            //Removing cards from hand
            var builder = Builders<Game>.Filter;
            var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            List<UpdateDefinition<Game>> playerUpdates = new List<UpdateDefinition<Game>>();
            for (int i = 0; i < fromHand.Count; i++)
            {
                Card card = fromHand.ElementAt(i);
                collectedCards.Add(card);
                playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", card));
            }
            
            var sortedCards = sortCards(collectedCards);
            //Adding cards to point card pile
            for (int i = 0; i < sortedCards[0].Count; i++)
            {
                playerUpdates.Add(Builders<Game>.Update.Push("Players.$.PointCards", sortedCards[0].ElementAt(i)));
            }
            //Adding cards to normal card pile
            for (int i = 0; i < sortedCards[1].Count; i++)
            {
                playerUpdates.Add(Builders<Game>.Update.Push("Players.$.NormalCards", sortedCards[1].ElementAt(i)));
            }
            var roomFilter = getFilter(roomCode);
            foreach(UpdateDefinition<Game> update in tableUpdates)
            {
                await games.UpdateOneAsync(roomFilter, update);
            }
            foreach(UpdateDefinition<Game> update in playerUpdates)
            {
                await games.UpdateOneAsync(filterThisPlayer, update);
            }
        }

        public async Task PlayKings(string roomCode, string playerName, List<Card> kings) {
            var builder = Builders<Game>.Filter;
            var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            List<UpdateDefinition<Game>> playerUpdates = new List<UpdateDefinition<Game>>();
            for (int i = 0; i < kings.Count; i++)
            {
                //Removing king from hand
                playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", kings[i]));
                //Adding king to play
                List<Card> newKing = new List<Card>();
                newKing.Add(kings[i]);
                playerUpdates.Add(Builders<Game>.Update.Push("Players.$.Kings", newKing));
            }
            foreach (UpdateDefinition<Game> update in playerUpdates)
            {
                await games.UpdateOneAsync(filterThisPlayer, update);
            }
        }

		public async Task PlayQueenAndJacks(string roomCode, List<string> playerNames, List<Card> queenAndJacks, List<Card> fromTable)
		{
			List<Card> collectedCards = new List<Card>();
			//Removing cards from table
			List<UpdateDefinition<Game>> tableUpdates = new List<UpdateDefinition<Game>>();
			for (int i = 0; i < fromTable.Count; i++)
			{
				Card card = fromTable.ElementAt(i);
				collectedCards.Add(card);
				tableUpdates.Add(Builders<Game>.Update.Pull("Table", card));
			}
			List<UpdateDefinition<Game>>[] updateHolders = new List<UpdateDefinition<Game>>[playerNames.Count];
			FilterDefinition<Game>[] filterHolders = new FilterDefinition<Game>[playerNames.Count];
			var builder = Builders<Game>.Filter;
			//Removing cards from hands
			for (int i = 0; i < playerNames.Count; i++)
			{
				filterHolders[i] = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerNames.ElementAt(i));
				updateHolders[i] = new List<UpdateDefinition<Game>>();
				updateHolders[i].Add(Builders<Game>.Update.Pull("Players.$.Hand", queenAndJacks.ElementAt(i)));
				collectedCards.Add(queenAndJacks.ElementAt(i));
			}

			var sortedCards = sortCards(collectedCards);
			//Adding cards to point card pile
			for (int i = 0; i < sortedCards[0].Count; i++)
			{
				updateHolders[0].Add(Builders<Game>.Update.Push("Players.$.PointCards", sortedCards[0].ElementAt(i)));
			}
			//Adding cards to normal card pile
			for (int i = 0; i < sortedCards[1].Count; i++)
			{
				updateHolders[0].Add(Builders<Game>.Update.Push("Players.$.NormalCards", sortedCards[1].ElementAt(i)));
			}

			var roomFilter = getFilter(roomCode);
			foreach (UpdateDefinition<Game> update in tableUpdates)
			{
				await games.UpdateOneAsync(roomFilter, update);
			}
			for(int i = 0; i < updateHolders.Length; i++)
			{
				foreach (UpdateDefinition<Game> update in updateHolders[i])
				{
					await games.UpdateOneAsync(filterHolders[i], update);
				}
			}
		}

        //public async Task PlayQueen(string roomCode, string playerName, Card queen, List<Card> fromTable) {
        //    List<Card> collectedCards = new List<Card>();
        //    //Removing cards from table
        //    List<UpdateDefinition<Game>> tableUpdates = new List<UpdateDefinition<Game>>();
        //    for (int i = 0; i < fromTable.Count; i++)
        //    {
        //        Card card = fromTable.ElementAt(i);
        //        collectedCards.Add(card);
        //        tableUpdates.Add(Builders<Game>.Update.Pull("Table", card));
        //    }
        //    //Removing queen from hand
        //    var builder = Builders<Game>.Filter;
        //    var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
        //    List<UpdateDefinition<Game>> playerUpdates = new List<UpdateDefinition<Game>>();
        //    playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", queen));
        //    collectedCards.Add(queen);
            
        //    var sortedCards = sortCards(collectedCards);
        //    //Adding cards to point card pile
        //    for (int i = 0; i < sortedCards[0].Count; i++)
        //    {
        //        playerUpdates.Add(Builders<Game>.Update.Push("Players.$.PointCards", sortedCards[0].ElementAt(i)));
        //    }
        //    //Adding cards to normal card pile
        //    for (int i = 0; i < sortedCards[1].Count; i++)
        //    {
        //        playerUpdates.Add(Builders<Game>.Update.Push("Players.$.NormalCards", sortedCards[1].ElementAt(i)));
        //    }
        //    var roomFilter = getFilter(roomCode);
        //    foreach (UpdateDefinition<Game> update in tableUpdates)
        //    {
        //        await games.UpdateOneAsync(roomFilter, update);
        //    }
        //    foreach (UpdateDefinition<Game> update in playerUpdates)
        //    {
        //        await games.UpdateOneAsync(filterThisPlayer, update);
        //    }
        //}

        //public async Task PlayJackOfClubs(string roomCode, string playerName, string queenPlayerName, Card queen, List<Card> fromTable) {
        //    List<Card> collectedCards = new List<Card>();
        //    //Removing cards from table
        //    List<UpdateDefinition<Game>> tableUpdates = new List<UpdateDefinition<Game>>();
        //    for (int i = 0; i < fromTable.Count; i++)
        //    {
        //        Card card = fromTable.ElementAt(i);
        //        collectedCards.Add(card);
        //        tableUpdates.Add(Builders<Game>.Update.Pull("Table", card));
        //    }
        //    //Removing jack of clubs from hand
        //    var builder = Builders<Game>.Filter;
        //    var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
        //    List<UpdateDefinition<Game>> playerUpdates = new List<UpdateDefinition<Game>>();
        //    Card jofc = new Card { number = 11, suit = "clubs" };
        //    playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", jofc));
        //    collectedCards.Add(jofc);
        //    //Removing queen from other hand
        //    var filterOtherPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", queenPlayerName);
        //    var otherPlayerUpdate = Builders<Game>.Update.Pull("Players.$.Hand", queen);
        //    collectedCards.Add(queen);

        //    var sortedCards = sortCards(collectedCards);
        //    //Adding cards to point card pile
        //    for (int i = 0; i < sortedCards[0].Count; i++)
        //    {
        //        playerUpdates.Add(Builders<Game>.Update.Push("Players.$.PointCards", sortedCards[0].ElementAt(i)));
        //    }
        //    //Adding cards to normal card pile
        //    for (int i = 0; i < sortedCards[1].Count; i++)
        //    {
        //        playerUpdates.Add(Builders<Game>.Update.Push("Players.$.NormalCards", sortedCards[1].ElementAt(i)));
        //    }
        //    var roomFilter = getFilter(roomCode);
        //    foreach (UpdateDefinition<Game> update in tableUpdates)
        //    {
        //        await games.UpdateOneAsync(roomFilter, update);
        //    }
        //    await games.UpdateOneAsync(filterOtherPlayer, otherPlayerUpdate);
        //    foreach (UpdateDefinition<Game> update in playerUpdates)
        //    {
        //        await games.UpdateOneAsync(filterThisPlayer, update);
        //    }
        //}

        public async Task PlayJackOfSpades(string roomCode, string playerName, string victimName, Card jack)
        {
            Game game = await GetGame(roomCode);
            var builder = Builders<Game>.Filter;
            var playerFilter = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            var playerUpdates = new List<UpdateDefinition<Game>>();
            playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", jack));
            var otherPlayerFilter = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", victimName);
            Card cardToPull = game.Players.Where(p => p.Name.Equals(victimName)).Single().PointCards[0];
            var otherPlayerUpdate = Builders<Game>.Update.Pull("Players.$.PointCards", cardToPull);
            playerUpdates.Add(Builders<Game>.Update.Push("Players.$.PointCards", cardToPull));
            await games.UpdateOneAsync(otherPlayerFilter, otherPlayerUpdate);
            foreach(UpdateDefinition<Game> update in playerUpdates)
            {
                await games.UpdateOneAsync(playerFilter, update);
            }
        }

        public async Task UseForKing(string roomCode, string playerName, string source, List<Card> cards) {
            Game game = await GetGame(roomCode);
            var builder = Builders<Game>.Filter;
            //Remove used cards from source
            if(source.Equals("table"))
            {
                var roomFilter = getFilter(roomCode);
                var tableUpdates = new List<UpdateDefinition<Game>>();
                foreach(Card card in cards)
                {
                    tableUpdates.Add(Builders<Game>.Update.Pull("Table", card));
                }
                foreach(UpdateDefinition<Game> update in tableUpdates)
                {
                    await games.UpdateOneAsync(roomFilter, update);
                }
            } else
            {
                if(!source.Equals(playerName))
                {
                    var otherPlayerFilter = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", source);
                    var otherPlayerUpdates = new List<UpdateDefinition<Game>>();
                    foreach (Card card in cards)
                    {
                        otherPlayerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", card));
                    }
                    foreach (UpdateDefinition<Game> update in otherPlayerUpdates)
                    {
                        await games.UpdateOneAsync(otherPlayerFilter, update);
                    }
                }
            }
            var playerFilter = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            var playerUpdates = new List<UpdateDefinition<Game>>();
            if(source.Equals(playerName))
            {
                foreach (Card card in cards)
                {
                    playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Hand", card));
                }
                //Updates will be run at end
            }
            //Organize cards into list of lists, where each lists the cards going to the corresponding king
            var collectedCards = new List<Card>();
            var sortedCards = new List<List<Card>>();
            var kings = game.Players.Where(p => p.Name.Equals(playerName)).Select(p => p.Kings).Single();
            for(int i = 0; i < kings.Count; i++)
            {
                sortedCards.Add(new List<Card>());
                var neededNumbers = getNeededNumbers(kings[i][0].suit);
                for(int j = 1; j < kings[i].Count; j++)
                {
                    neededNumbers.Remove(kings[i][j].number);
                }
                for(int j = cards.Count - 1; j >= 0; j--)
                {
                    if(neededNumbers.Contains(cards[j].number))
                    {
                        sortedCards[i].Add(cards[j]);
                        neededNumbers.Remove(cards[j].number);
                        cards.Remove(cards[j]);
                    }
                }
                //If the spell is complete, we will move all the cards into collected cards instead, and pull the spell
                if(neededNumbers.Count == 0)
                {
                    foreach(Card card in kings[i])
                    {
                        collectedCards.Add(card);
                    }
                    foreach(Card card in sortedCards[i])
                    {
                        collectedCards.Add(card);
                    }
                    sortedCards[i].Clear();
                    playerUpdates.Add(Builders<Game>.Update.Pull("Players.$.Kings", kings[i]));
                }
            }
            //Add collected cards
            var sortedCollectedCards = sortCards(collectedCards);
            //   Adding cards to point card pile
            for (int i = 0; i < sortedCollectedCards[0].Count; i++)
            {
                playerUpdates.Add(Builders<Game>.Update.Push("Players.$.PointCards", sortedCollectedCards[0].ElementAt(i)));
            }
            //   Adding cards to normal card pile
            for (int i = 0; i < sortedCollectedCards[1].Count; i++)
            {
                playerUpdates.Add(Builders<Game>.Update.Push("Players.$.NormalCards", sortedCollectedCards[1].ElementAt(i)));
            }
            //Add cards to spells
            for(int i = 0; i < sortedCards.Count; i++)
            {
                foreach(Card card in sortedCards[i])
                {
                    playerUpdates.Add(Builders<Game>.Update.Push("Players.$.Kings." + i, card));
                }
            }

            foreach(var update in playerUpdates)
            {
                await games.UpdateOneAsync(playerFilter, update);
            }
        }

        //Helper
        private List<int> getNeededNumbers(string suit)
        {
            var neededNumbers = new List<int>();
            switch (suit)
            {
                case "hearts":
                    neededNumbers.Add(1);
                    neededNumbers.Add(5);
                    neededNumbers.Add(9);
                    break;
                case "diamonds":
                    neededNumbers.Add(2);
                    neededNumbers.Add(6);
                    neededNumbers.Add(10);
                    break;
                case "clubs":
                    neededNumbers.Add(3);
                    neededNumbers.Add(7);
                    neededNumbers.Add(11);
                    break;
                case "spades":
                    neededNumbers.Add(4);
                    neededNumbers.Add(8);
                    break;
            }
            return neededNumbers;
        }

        //Figures out which cards are point cards and which are normal cards
        public List<Card>[] sortCards(List<Card> cards)
        {
            List<Card> pointCards = new List<Card>(); //The normal cards will simply be left in collectedCards
            List<Card> normalCards = new List<Card>(); //The normal cards will simply be left in collectedCards
            for (int i = cards.Count - 1; i >= 0; i--)
            {
                bool isPoint = false;
                Card card = cards.ElementAt(i);
                switch (card.number)
                {
                    case 12:
                    case 13:
                    case 6:
                        isPoint = true;
                        break;
                    case 11:
                        if (card.suit.Equals("clubs") || card.suit.Equals("spades"))
                        {
                            isPoint = true;
                        }
                        break;
                    case 7:
                    case 4:
                        if (card.suit.Equals("hearts"))
                        {
                            isPoint = true;
                        }
                        break;
                    default:
                        break;
                }
                if (isPoint)
                {
                    pointCards.Add(card);
                } else
                {
                    normalCards.Add(card);
                }
            }
            List<Card>[] result = { pointCards, normalCards };
            return result;
        }

        public async Task<Results> PlayerDone(string roomCode, string playerName)
        {
            var builder = Builders<Game>.Filter;
            var filterThisPlayer = builder.Eq("RoomCode", roomCode) & builder.Eq("Players.Name", playerName);
            var update = Builders<Game>.Update.Set("Players.$.Done", true);
            await games.UpdateOneAsync(filterThisPlayer, update);
            Game game = await GetGame(roomCode);
            if(game.Players.Where(p => !p.Done).Count() == 0)
            { // Game over
                //Write names and tally normal cards, and note who has the most
                List<string> names = new List<string>();
                List<int> normalCards = new List<int>();
                List<int> playersWithMostNCs = new List<int>();
                int maxNCs = 0;
                for (int i = 0; i < game.Players.Count; i++)
                {
                    names.Add(game.Players[i].Name);
                    int count = game.Players[i].NormalCards.Count;
                    normalCards.Add(count);
                    if (count == maxNCs)
                    {
                        playersWithMostNCs.Add(i);
                    }
                    if (count > maxNCs)
                    {
                        playersWithMostNCs = new List<int>();
                        playersWithMostNCs.Add(i);
                        maxNCs = count;
                    }
                }
                //Add normal card bonuses
                List<int> normalCardBonuses = new List<int>();
                bool justOne = playersWithMostNCs.Count == 1;
                for (int i = 0; i < game.Players.Count; i++)
                {
                    if(normalCards[i] == maxNCs)
                    {
                        normalCardBonuses.Add(justOne ? 2 : 1);
                    } else
                    {
                        normalCardBonuses.Add(0);
                    }
                }
                //Tally points
                List<int> pointCards = new List<int>();
                for (int i = 0; i < game.Players.Count; i++)
                {
                    pointCards.Add(game.Players[i].PointCards.Count);
                }
                //Tally scores, and note who has the most
                List<int> scores = new List<int>();
                List<string> winners = new List<string>();
                int maxPts = 0;
                for (int i = 0; i < game.Players.Count; i++)
                {
                    int score = pointCards[i] + normalCardBonuses[i];
                    scores.Add(score);
                    if (score == maxPts)
                    {
                        winners.Add(names[i]);
                    }
                    if (score > maxPts)
                    {
                        winners = new List<string>();
                        winners.Add(names[i]);
                        maxPts = score;
                    }
                }
                //Save and return results
                var results = new Results
                {
                    PlayerNames = names,
                    NormalCardCounts = normalCards,
                    NormalCardBonuses = normalCardBonuses,
                    PointCardCounts = pointCards,
                    Scores = scores,
                    Winners = winners
                };
                var resultsUpdate = Builders<Game>.Update.Set("Results", results);
                await games.UpdateOneAsync(getFilter(roomCode), resultsUpdate);
                return results;
            }
            return null;
        }

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