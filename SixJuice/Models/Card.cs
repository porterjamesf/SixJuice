using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class Card
    {
        //1-13: 1=Ace; 11,12,13=Jack,Queen,King
        public int number { get; set; }
        //hearts, diamonds, clubs, spades
        public string suit { get; set; }
    }
}