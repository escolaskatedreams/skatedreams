from finalizer.domain.data_termino import compute_data_termino


def test_data_termino_max_presenca():
    calendario_rows = [
        ["Aluno | id: 12", "7", "01/04/2026 10:00", "01/04/2026 11:00", "", "Presença", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 12", "11", "08/04/2026 10:00", "08/04/2026 11:00", "", "Falta", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 12", "7", "15/04/2026 10:00", "15/04/2026 11:00", "", "Presença", "12", "", "Aluno", "100", "Carlos"],
        ["Aluno | id: 99", "7", "20/04/2026 10:00", "20/04/2026 11:00", "", "Presença", "99", "", "Outro", "100", "Carlos"],
    ]
    assert compute_data_termino(calendario_rows, 12) == "15/04/2026"


def test_data_termino_no_presenca_returns_none():
    calendario_rows = [
        ["Aluno | id: 12", "11", "01/04/2026 10:00", "01/04/2026 11:00", "", "Falta", "12", "", "", "", ""],
    ]
    assert compute_data_termino(calendario_rows, 12) is None


def test_data_termino_id_not_found():
    assert compute_data_termino([], 12) is None
