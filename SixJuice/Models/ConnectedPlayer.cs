using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class ConnectedPlayer
    {
        [BsonId]
        public ObjectId Id { get; set; }
        public string ConnectionId { get; set; }
        public string PlayerName { get; set; }
        public string RoomCode { get; set; }
        public string Screen { get; set; }
    }
}