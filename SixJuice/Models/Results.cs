using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace SixJuice.Models
{
    public class Results
    {
        public List<string> PlayerNames { get; set; }
        public List<int> NormalCardCounts { get; set; }
        public List<int> NormalCardBonuses { get; set; }
        public List<int> PointCardCounts { get; set; }
        public List<int> Scores { get; set; }
        public List<string> Winners { get; set; }
    }
}