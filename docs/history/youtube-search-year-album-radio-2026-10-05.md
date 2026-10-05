# Ano da busca e recomendações de álbuns

O parser conserva o ano quando o YouTube Music o fornece como metadado separado no resultado de uma faixa, junto das identidades de álbum e artista já presentes. Faixas listadas dentro de um álbum também herdam seu ano. Um ano conhecido evita a consulta adicional dos detalhes do álbum apenas para obter o lançamento; quando ausente, o fallback existente permanece. Não se inventa uma data completa a partir do ano.

Recomendações dentro de álbuns com identidade YouTube Music usam uma faixa do álbum como semente do rádio e deduplicam os álbuns identificados nas faixas retornadas, omitindo o álbum de origem. Não consultam o Last.fm nem fazem buscas por cada recomendação. Sem uma faixa utilizável ou identidades de álbuns no rádio, retornam uma lista vazia. Identidades antigas de outros catálogos mantêm seu fluxo anterior. Descrições e tags complementares continuam no Last.fm.

Validação: 13 testes do catálogo passaram, incluindo retenção do ano, ausência da consulta redundante e isolamento das recomendações de álbuns do Last.fm. Consulta real de rádio retornou 40 faixas com identidades de álbum em todas elas.
