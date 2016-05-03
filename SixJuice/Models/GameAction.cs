using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class GameAction
    {
        public string playerName { get; set; }
        public string action { get; set; }
        public List<Card> hand { get; set; }
        public List<Card> table { get; set; }
        public string misc { get; set; }
    }
}