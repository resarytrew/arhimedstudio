import manimgx as m
from Bio.Seq import Seq
from Bio.SeqUtils import gc_fraction


class BiologyLesson(m.Scene):
    def construct(self):
        dna = Seq("ATGGCCATT")
        rna = dna.transcribe()
        protein = dna.translate()
        assert str(protein) == "MAI"
        title = m.Text("От ДНК к белку", font_size=36).shift(2.7 * m.UP)
        dna_label = m.Text("ДНК: " + str(dna), font_size=30, color=m.BLUE).shift(1.3 * m.UP)
        rna_label = m.Text("РНК: " + str(rna), font_size=30, color=m.TEAL)
        protein_label = m.Text("Белок: " + str(protein), font_size=30, color=m.YELLOW).shift(1.3 * m.DOWN)
        result = m.Text("GC-состав: " + str(round(100 * gc_fraction(dna), 1)) + "%", font_size=28).shift(2.5 * m.DOWN)
        self.play(m.Write(title), run_time=1.0)
        self.play(m.Write(dna_label), run_time=1.0)
        self.wait(0.5)
        self.play(m.Write(rna_label), run_time=1.5)
        self.wait(0.5)
        self.play(m.Write(protein_label), run_time=1.5)
        self.play(m.Write(result), run_time=1.0)
        self.wait(1.0)
