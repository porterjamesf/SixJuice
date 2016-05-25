using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class Player
    {
        public string Name { get; set; }
        public bool Ready { get; set; }
        public bool Done { get; set; }
        public List<Card> PointCards { get; set; }
        public List<Card> NormalCards { get; set; }
        public List<Card> Hand { get; set; }
        public List<List<Card>> Kings { get; set; }
        public List<List<Card>> KSources { get; set; }
    }
}