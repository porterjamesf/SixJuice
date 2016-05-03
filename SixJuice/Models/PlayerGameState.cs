using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class PlayerGameState
    {
        //Global
        public int DeckCount { get; set; }
        public List<Card> Table { get; set; }
        public string WhosTurn { get; set; }
        //This player
        public List<Card> Hand { get; set; }
        public List<List<Card>> Kings { get; set; }
        public int PointCardCount { get; set; }
        public FacingDeck NormalCards { get; set; }
        //Other players
        public List<OtherPlayerState> OtherPlayers { get; set; }
    }
}