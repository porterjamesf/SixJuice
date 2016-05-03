using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class NewTurn
    {
        public string nextPlayerName { get; set; }
        public List<Card> drawnCards { get; set; }
    }
}