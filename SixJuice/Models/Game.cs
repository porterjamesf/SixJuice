using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class Game
    {
        [BsonId]
        public ObjectId Id { get; set; }
        public string RoomCode { get; set; }
        public int Turn { get; set; }
        public int DeckCount { get; set; }
        public List<Card> Deck { get; set; }
        public List<Card> Table { get; set; }
        public List<Player> Players { get; set; }
        public Results Results { get; set; }
    }
}