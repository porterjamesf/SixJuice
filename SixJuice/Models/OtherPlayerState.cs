using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class OtherPlayerState
    {
        public string PlayerName { get; set; }
        public int HandCount { get; set; }
        public List<List<Card>> Kings { get; set; }
        public int PointCardCount { get; set; }
        public FacingDeck NormalCards { get; set; }
    }
}