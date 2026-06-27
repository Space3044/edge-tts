const TOKEN_REFRESH_BEFORE_EXPIRY = 3 * 60;
let tokenInfo = {
    endpoint: null,
    token: null,
    expiredAt: null
};

const FAVICON_ICO_BASE64 = "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uv90gL3/cIG//22Dwv9qhMX/Z4bI/2SHy/9hic7/XYrR/1qM0/9Xjdb/VI/Z/1GQ3P9Okt//SpPixAAAAACrZYpSqGaN/6VokP+iaZP/nmuV/5tsmP+Ybpv/lW+e/5Jxof+PcqT/jHSn/4h1qv+Fd6z/gnmv/396sv98fLX/eX24/3V/u/9ygL7/b4LA/2yDw/9phcb/ZobJ/2KIzP9fic//XIvS/1mM1f9Wjtf/U4/a/1CR3f9Mk+D/SZTjUq1kiKaqZYv/p2eO/6Rokf+gapT/nWuX/5ptmf+Xbpz/lHCf/5Fxov+Nc6X/inWo/4d2q/+EeK7/gXmw/357s/97fLb/d365/3R/vP9xgb//boLC/2uExP9ohcf/ZIfK/2GIzf9eitD/W4vT/1iN1v9Vj9n/UZDb/06S3v9Lk+Gmr2OG36xkif+pZoz/pmeP/6Jpkv+fapX/nGyY/5ltm/+Wb53/k3Gg/49yo/+MdKb/iXWp/4Z3rP+DeK//gHqy/3x7tP95fbf/dn66/3OAvf9wgcD/bYPD/2qExv9mhsj/Y4fL/2CJzv9di9H/WozU/1eO1/9Tj9r/UJHd/02S39+xYoX8rmOI/6tliv+nZo3/pGiQ/6Fpk/+ea5b/m22Z/5hunP+VcJ//kXGh/45zpP+LdKf/iHaq/4V3rf+CebD/fnqz/3t8tf94fbj/dX+7/3KAvv9vgsH/a4PE/2iFx/9lh8r/YojM/1+Kz/9ci9L/WY3V/1WO2P9SkNv/T5He/LNhg/+wYob/rWSJ/6lljP+mZ47/o2mR/6BqlP+dbJf/mm2a/5Zvnf+TcKD/kHKj/41zpf+Kdaj/h3ar/5eOu/+Uj77/fXu0/3p8t/93frn/dH+8/3GBv/9tg8L/aoTF/2eGyP9kh8v/YYnO/16K0P9ajNP/V43W/1SP2f9RkNz/tWCB/7JhhP+uY4f/q2WK/6hmjf+laJD/ommS/59rlf+cbJj/mG6b/5Vvnv+ScaH/j3Kk/4x0pv+UgrH///////////+Lh7n/fHu1/3l9uP92f7v/coC9/2+CwP9sg8P/jqPU/4ih1f9jiMz/YInP/1yL0v9ZjNT/Vo7X/1OP2v+3X3//tGGC/7Bihf+tZIj/qmWL/6dnjv+kaJH/oWqU/51rlv+abZn/spS2/+DW4/+xm73/jnOl/5yJtf///////////5SNvP9+e7P/e3y2/3h+uf90f7z/cYG//4SVy////////////3GQzv9hiM3/XorQ/1uL0/9YjdX/VY7Y/7lefv+2YIH/smGD/69jhv+sZIn/qWaM/6Znj/+jaZL/n2qV/5xsmP/Zydr//////9vQ4P+QcqP/nYiz////////////loy6/4B6sf+qqc7/4+Tw/6Gn0P9zgL3/i5nM////////////eJPO/2OHy/9gic7/XYrR/1qM1P9Xjtf/u118/7dff/+0YIL/sWKF/65jh/+rZYr/5dHd/+jY4v+haZP/nmuW/9rJ2f//////3M/f/5Jxof+fiLL///////////+Xi7n/gnmw/9XT5v//////zc/l/3V/u/+NmMr///////////96ks3/ZYbJ/2KIzP9fis//XIvS/1mN1f+9XHr/uV59/7ZfgP+zYYP/sGKG/7Z1lv///////////7SFpv+gapT/28jZ///////dz9//k3Cf/6GHsP///////////5mLuP+EeK7/1dPl///////Oz+T/d365/46Xyf///////////3qSy/9nhsj/ZIfK/2GJzf9eitD/W4zT/75beP+7XXv/uF5+/7Vggf+yYYT/uHSU////////////toSk/6Jpkv/byNj//////93P3v+Vb57/ooav////////////m4q2/4Z3rP/W0uX//////8/O5P95fbj/kJfH////////////fJHK/2mFxv9mhsn/Y4jM/2CJzv9di9H/wFp3/71cev+6XXz/t19//7Rggv+6c5L///////////+4hKP/pGiQ/9zI1///////3s/d/5dunP+kha3///////////+cibT/iHaq/9bS5P//////z87j/3t8tv+Sl8b///////////9+kMj/a4TE/2iFx/9lh8r/YojN/1+K0P/CWXX/v1t4/7xce/+5Xn7/tl+A/7tykf///////////7mDov+mZ4//3cjX///////ezt3/mW2a/6aFrP///////////56Is/+Kdan/19Lj///////QzuL/fXu0/5OWxf///////////4CPxv9tg8L/aoTF/2eGyP9kh8v/YInO/8RYc//BWnb/vlt5/7tdfP+4X3//tGCB/+jQ2v/q1+D/q2WK/6hmjf/ex9b//////9/O3P+bbJj/p4Sq////////////oIey/4t0p//Y0uP//////9HN4f9/erL/lZXD////////////go7F/2+Cwf9sg8P/aYXG/2aGyf9iiMz/xldx/8NZdP/AW3f/vVx6/7peff+2X4D/s2GD/7Bihf+tZIj/qmWL/97H1f//////4M7c/51rl/+pg6n///////////+ih7D/jXOl/7Olxv/m4u3/q6PI/4F5sP+XlMH///////////+DjcP/cYG//26Cwv9rhMX/Z4XH/2SHyv/IV3D/xVhz/8Jadf+/W3j/vF17/7hefv+1YIH/smGE/69jh/+sZIn/wI6q/+XT3/+9lbL/n2qV/6uCp////////////6KGrv+PcqP/jHSm/4l1qf+Gd6z/g3iv/5SPvv///////////4CIv/9zgL3/cIHA/22Dw/9phMb/ZobJ/8pWbv/HV3H/xFl0/8Fadv+9XHn/ul18/7dff/+0YIL/sWKF/65jiP+rZYv/p2aN/6RokP+hapP/p3mg////////////nn6o/5Fxov+Oc6T/i3Sn/4h2qv+Fd63/gXmw/56bxv+Ymcb/eH24/3V/u/9ygL7/b4LB/2uExP9ohcf/zFVs/8lWb//GWHL/w1l1/79beP+8XHr/uV59/7ZfgP+zYYP/sGKG/6xkif+pZoz/pmeP/6Npkf+gapT/rYSo/6qFqv+Wb53/k3Cg/5Byo/+Nc6X/inWo/4d2q/+DeK7/gHmx/317tP96fLf/d366/3SAvP9wgb//bYPC/2qExf/OVGr8y1Vt/8hXcP/EWHP/wVp2/75bef+7XXz/uF5+/7Vggf+yYoT/rmOH/6tliv+oZo3/pWiQ/6Jpk/+fa5X/m2yY/5hum/+Vb57/knGh/49ypP+MdKf/iHWp/4V3rP+CeK//f3qy/3x8tf95fbj/dn+7/3KAvv9vgsD/bIPD/NBTad/NVGv/ylZu/8ZXcf/DWXT/wFp3/71cev+6Xn3/t1+A/7Nhgv+wYoX/rWSI/6pli/+nZ47/pGiR/6FqlP+da5b/mm2Z/5dunP+UcJ//kXGi/45zpf+KdKj/h3ar/4R4rf+BebD/fnuz/3t8tv93frn/dH+8/3GBv/9ugsLf0lJnps9Tav/MVW3/yFZv/8VYcv/CWnX/v1t4/7xde/+5Xn7/tWCB/7JhhP+vY4b/rGSJ/6lmjP+mZ4//ommS/59qlf+cbJj/mW2a/5Zv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o/+Oc6X/i3Sn/4l1qf+Hdqv/hXet/4N4rv+BebD/f3qy/317tP97fLb/eH24/3Z+uv90f7z/coC+/3CBwP9ugsL/bIPD/2qExf9ohcf/ZobJ/2OHy/9hiM3/X4nP/12K0f9bi9P/WYzV/1eN1/9Vj9j/U5Da/1CR3P9Okt7/TJPg/0qU4pIAAAAAAAAAAAAAAAAAAAAAAAAAAKRokWyiaZL/oGqU/55rlv+bbJj/mW2a/5dunP+Vb57/k3Cg/5Fxov+PcqT/jXOm/4t0qP+Jdan/hnar/4R3rf+CeK//gHmx/356s/98fLX/en23/3h+uf92f7v/c4C9/3GBvv9vgsD/bYPC/2uExP9phcb/Z4bI/2WHyv9jiMz/YYnO/16K0P9ci9L/WozT/1iN1f9Wjtf/VI/Z/1KQ2/9Qkd3/TpLf/0uT4f9JlONsAAAAAAAAAAAAAAAAp2aNIaVoj/ujaZH/oWqT/59rlf+dbJf/m22Z/5lum/+Wb53/lHCf/5Jxof+QcqP/jnOk/4x0pv+Kdaj/iHaq/4Z3rP+DeK7/gXmw/396sv99e7T/e3y2/3l9uP93frn/dX+7/3OAvf9xgb//boLB/2yDw/9qhMX/aIXH/2aGyf9kh8v/YojN/2CJzv9eitD/W4vS/1mM1P9Xjdb/VY7Y/1OP2v9RkNz/T5He/02S4P9Lk+L7SZTkIQAAAAAAAAAAqWaMmqZnjv+kaJD/ommS/6BqlP+ea5b/nGyY/5ptmv+Ybpz/lm+e/5Rwn/+RcaH/j3Kj/41zpf+LdKf/iXWp/4d2q/+Fd63/g3iv/4F5sf9+erP/fHu0/3p8tv94fbj/dn66/3R/vP9ygL7/cIHA/26Cwv9sg8T/aYTG/2eFyP9lh8n/Y4jL/2GJzf9fis//XYvR/1uM0/9ZjdX/Vo7X/1SP2f9SkNv/UJHd/06S3/9Mk+D/SpTimgAAAACsZIkXqmWL/6hmjf+mZ4//pGiR/6Fpk/+fapX/nWuX/5tsmf+ZbZr/l26c/5Vvnv+TcKD/kXGi/45ypP+MdKb/inWo/4h2qv+Gd6z/hHiu/4J5r/+AerH/fnuz/3x8tf95fbf/d365/3V/u/9zgL3/cYG//2+Cwf9tg8P/a4TE/2mFxv9mhsj/ZIfK/2KIzP9gic7/XorQ/1yL0v9ajNT/WI3W/1aO2P9Uj9r/UZDb/0+R3f9Nkt//S5Ph/0mU4xetZIhpq2WK/6lmjP+nZ47/pWiQ/6Npkv+hapT/n2uV/5xsl/+abZn/mG6b/5Zvnf+UcJ//knGh/5Byo/+Oc6X/jHSn/4l1qf+Hdqr/hXes/4N4rv+BebD/f3qy/317tP97fLb/eX24/3d+uv90f7z/coC+/3CBwP9ugsH/bIPD/2qExf9ohcf/ZobJ/2SHy/9hiM3/X4nP/12K0f9bi9P/WYzV/1eN1v9Vjtj/U4/a/1GQ3P9Pkt7/TJPg/0qU4mmvY4errGSJ/6pli/+oZo3/pmeP/6RokP+iaZL/oGqU/55rlv+cbJj/mm2a/5dunP+Vb57/k3Cg/5Fxov+PcqT/jXOl/4t0p/+Jdan/h3ar/4R3rf+CeK//gHmx/356s/98e7X/eny3/3h9uf92f7v/dIC8/3GBvv9vgsD/bYPC/2uExP9phcb/Z4bI/2WHyv9jiMz/YYnO/1+K0P9ci9H/WozT/1iN1f9Wjtf/VI/Z/1KQ2/9Qkd3/TpLf/0yT4auwYobarmOI/6xkiv+qZYv/p2aN/6Vnj/+jaJH/oWmT/59rlf+dbJf/m22Z/5lum/+Xb53/lHCf/5JxoP+QcqL/jnOk/4x0pv+Kdaj/iHaq/4Z3rP+EeK7/gnmw/396sv99e7T/e3y2/3l9t/93frn/dX+7/3OAvf9xgb//b4LB/2yDw/9qhMX/aIXH/2aGyf9kh8v/YojM/2CJzv9eitD/XIvS/1qM1P9Xjdb/VY7Y/1OP2v9RkNz/T5He/02S4NqxYoX2r2OG/61kiP+rZYr/qWaM/6dnjv+laJD/ommS/6BqlP+ea5b/nGyY/5ptmv+Ybpv/lm+d/5Rwn/+ScaH/j3Kj/41zpf+LdKf/iXWp/4d2q/+Fd63/g3iv/4F5sf9/erL/fXu0/3p8tv94fbj/dn66/3R/vP9ygL7/cIHA/26Cwv9sg8T/aoTG/2eFx/9lhsn/Y4fL/2GIzf9fis//XYvR/1uM0/9ZjdX/V47X/1SP2f9SkNv/UJHc/06S3vayYYP/sGKF/65jh/+sZIn/qmWL/6hmjf+mZ4//pGiR/6Jpk/+fapX/nWuW/5tsmP+ZbZr/l26c/5Vvnv+TcKD/kXGi/49ypP+Nc6b/inSo/4h1qv+Gd6z/hHit/4J5r/+AerH/fnuz/3x8tf96fbf/d365/3V/u/9zgL3/cYG//2+Cwf9tg8L/a4TE/2mFxv9nhsj/ZYfK/2KIzP9gic7/XorQ/1yL0v9ajNT/WI3W/1aO1/9Uj9n/UpDb/0+R3f+0YIL/smGE/7Bjhv+tZIj/q2WK/6lmjP+nZ47/pWiQ/6Npkv+hapP/n2uV/51sl/+abZn/mG6b/5Zvnf+UcJ//knGh/5Byo/+Oc6X/jHSn/4p1qP+Idqr/hXes/6ylyf+rpcr/f3qy/317tP97fLb/eX24/3d+uv91f7z/coC9/3CBv/9ugsH/bIPD/2qExf9ohcf/ZobJ/2SHy/9iiM3/YInP/12K0f9bi9L/WYzU/1eN1v9Vjtj/U4/a/1GQ3P+1YIH/s2GD/7Fihf+vY4f/rWSJ/6pli/+oZo3/pmeO/6RokP+iaZL/oGqU/55rlv+cbJj/mm2a/5hunP+Vb57/k3Cg/5Fxov+PcqP/jXOl/4t0p/+Jdan/xr7X////////////w7/a/356s/98e7X/eny3/3h9uP92frr/dH+8/3KAvv9wgsD/bYPC/2uExP9phcb/aYjJ/2WHyv9jiMz/YYnO/1+Kz/9di9H/WozT/1iN1f9Wjtf/VI/Z/1KQ2/+2X4D/tGCC/7JhhP+wYob/rmOI/6xkif+qZYv/qGaN/6Vnj/+jaJH/oWmT/59qlf+da5f/m2yZ/5ltm/+Xb53/lXCe/5x9qP+QcqL/jnOk/4x0pv+Kdaj/4d3q////////////4N3r/4B6sv99e7P/e3y1/3l9t/93frn/dX+7/3OAvf9xgb//b4LB/22Dw//S2u3//////8XR6/9kh8r/YojM/2CJzv9eitD/XIvS/1qM1P9Yjdb/VY7Y/1OP2v+4X3//tWCB/7Nhg/+xYoT/r2OG/61kiP+rZYr/qWaM/6dnjv+laJD/o2mS/6BqlP+ea5b/nGyY/5ptmf+lgKj/8Orx///////Qwtb/kHKj/41zpf+LdKf/4t3q////////////4N3r/4F5sP9/erL/fXu0/3t8tv94fbj/dn66/3R/vP9ygL7/cIHA/5mn1P////////////////+Am9P/Y4fL/2GIzf9fic//XYrR/1uL0/9ZjdX/V47X/1WP2f+5Xn7/t19//7Vggf+zYYP/sGKF/65jh/+sZIn/qmWL/6hmjf+mZ4//pGiR/6Jpk/+gapT/nmuW/5tsmP/Iscn/////////////////lHSk/49ypP+Nc6b/4tzp////////////4N3q/4J4r/+AerH/fnuz/6Ghyv/W1+n/v8Le/3Z/u/9zgL3/cYG//5yp1P////////////////+EndL/ZYfK/2OIzP9gic7/XorQ/1yL0v9ajNT/WI3V/1aO1/+6XXz/uF5+/7ZfgP+0YIL/smGE/7Bihv+uY4j/q2SK/6lljP+sb5T/wpm0/616nf+hapP/n2uV/51sl//Kssn/////////////////lXWk/5Byo/+Oc6T/4tzp////////////4d3q/4N4rv+BebD/f3qy//T0+f///////////6yw1f91f7v/c4C9/5yo0/////////////////+FnNL/ZobJ/2SHy/9iiM3/YInP/16K0P9bi9L/WYzU/1eN1v+7XXv/uV59/7dff/+1YIH/s2GD/7Fihf+vY4f/rWSJ/6tliv/y5+3///////n1+P+reJ3/oGqU/55rlv/Lscj/////////////////lnSi/5Fxof+PcqP/49zp////////////4d3q/4V3rf+DeK//hX2z/////////////////7e62f92frr/dH+8/56n0v////////////////+GnNH/Z4bI/2WHyv9jiMv/YYnN/1+Kz/9di9H/W4zT/1mN1f+9XHr/u118/7lefv+2X4D/tGCC/7JhhP+wYoX/rmOH/7yBn//////////////////Al7P/oWmT/59qlf/Lscj/////////////////mHOh/5NwoP+RcqL/49zo////////////4d3q/4Z3rP+EeK7/hn2y/////////////////7i62f93frn/dX+7/56n0f////////////////+Hm9D/aYXG/2aGyP9kh8r/YojM/2CJzv9eitD/XIvS/1qM1P++W3n/vFx7/7pdff+4X3//tmCA/7Rhgv+xYoT/r2OG/72Bn//////////////////Bl7L/o2mS/6FqlP/Mscf/////////////////mXOg/5Rwn/+ScaH/49zo////////////4dzp/4d2q/+Fd6z/h3yw/////////////////7m62P95fbj/dn66/5+n0f////////////////+Im87/aoTF/2iFx/9mhsn/ZIfL/2GIzf9fic//XYrR/1uL0/+/W3j/vVx6/7tde/+5Xn3/t19//7Vggf+zYYP/sWKF/72Bnv/////////////////ClrL/pGiR/6Jpkv/NsMb/////////////////mnKf/5Vvnv+TcKD/5Nzo////////////4tzp/4l1qf+Gdqv/iHuv/////////////////7q52P96fbf/eH65/6Cn0P////////////////+Jm87/a4TE/2mFxv9nhsj/ZYfK/2OIzP9hic7/XorQ/1yL0v/BWnb/v1t4/7xcev+6XXz/uF5+/7ZfgP+0YIL/smGE/7+Anf/////////////////ClbD/pWeP/6Nokf/NsMb/////////////////nHKe/5dvnf+UcJ//5Nzo////////////4tzp/4p1qP+Idqr/inuu/////////////////7q51/97fLb/eX23/6Gmz/////////////////+Kms3/bIPD/2qExf9ohcf/ZobJ/2SHy/9iiM3/YInO/16K0P/CWnX/wFt3/75cef+8XXv/uV59/7dff/+1YIH/s2GD/8CAnP/////////////////ElbD/p2eO/6RokP/OsMX/////////////////nXGd/5hunP+Wb53/5Nvn////////////4tzo/4t0p/+Jdan/i3qu/////////////////7u51v98e7T/eny2/6Klzv////////////////+Lmcz/boLC/2yDxP9phMb/Z4XI/2WGyf9jiMv/YYnN/1+Kz//DWXT/wVp2/79beP+9XHr/u118/7lefv+3X4D/tGCC/8F/m//////////////////Ela//qGaN/6Znj//Pr8X/////////////////nnCb/5ltmv+Xbpz/5dvn////////////49zo/4xzpv+Kdaj/jHqt/////////////////7y51v9+e7P/fHy1/6Olzf////////////////+Mmcv/b4LB/22Dw/9rhMT/aYXG/2eGyP9kh8r/YojM/2CJzv/EWHP/wll1/8Bad/++W3n/vFx7/7pdff+4Xn7/tl+A/7Rggv/z5+z///////r19/+0dZb/qWaM/6dnjv/Pr8T/////////////////n3Ca/5ptmf+Ybpv/5dvn////////////49zo/45zpf+MdKf/jnms/////////////////7y41f9/erL/fXu0/6Slzf////////////////+NmMr/cIG//26Cwf9sg8P/aoTF/2iFx/9mhsn/ZIfL/2KIzf/GWHL/xFl0/8Jadv+/W3j/vVx5/7tde/+5Xn3/t19//7Vggf+3aor/ypWt/7h0lP+tZIn/qmWL/6hmjf/QrsP/////////////////oW+Z/5xsmP+abZr/5dvm////////////49vo/49ypP+Nc6X/i3Sn//Xz+P///////////7Otzv+AebH/fnqz/6WkzP////////////////+OmMn/coG+/2+CwP9tg8L/a4TE/2mFxv9nhsj/ZYfK/2OIzP/HV3H/xVhz/8NZdP/BWnb/v1t4/71cev+6XXz/uF5+/7ZfgP+0YIL/smGE/7Bihv+uY4j/rGSJ/6pli//QrcL/////////////////oW6Y/51rl/+bbZn/5tvm////////////5Nvn/5Byov+Oc6T/jHSm/6ucwf/b1eX/xb7X/4R4rv+CebD/f3qy/6Wky/////////////////+Pl8j/c4C9/3GBv/9vgsH/bYPD/2qExf9ohcf/ZobJ/2SHyv/IVm//xldx/8RYc//CWnX/wFt3/75cef+8XXv/ul59/7hff/+1YIH/s2GD/7FihP+vY4b/rWSI/6tliv+0eZv/8unv///////XvtD/oGqU/55rlv+cbJj/5tvm////////////5Nvn/5Jxof+QcqP/jXOl/4t0p/+Jdan/h3ar/4V3rf+DeK//gXmw/6Whyf////////////////+Olcb/dH+8/3KAvv9wgcD/boLC/2yDxP9qhMX/aIXH/2WGyf/KVm7/yFdw/8VYcv/DWXT/wVp2/79beP+9XHr/u118/7lefv+3X3//tWCB/7Jhg/+wYoX/rmOH/6xkif+qZYv/qGaN/61zmP+kaJH/ommT/6Bqlf+da5b/5trl////////////5Nvn/5NwoP+RcaL/j3Kk/41zpv+KdKj/iHWq/4Z2q/+EeK3/gnmv/4B6sf/Y1+j//////83O5P94frn/dX+7/3OAvf9xgb//b4LA/22Dwv9rhMT/aYXG/2eGyP/LVW3/yVZv/8dXcf/FWHP/w1l1/8Bad/++W3n/vFx6/7pdfP+4Xn7/tl+A/7Rggv+yYYT/sGKG/61jiP+rZYr/qWaM/6dnjv+laJD/o2mR/6Fqk/+fa5X/0LnO////////////zbrQ/5Rwn/+ScaH/kHKj/45zpf+MdKb/inWo/4h2qv+Fd6z/g3iu/4F5sP9/erL/f321/3t8tv95fbj/d366/3V/u/9zgL3/cIG//26Cwf9sg8P/aoTF/2iFx//MVWz/ylZu/8hXcP/GWHL/xFl0/8Jadv/AW3f/vVx5/7tde/+5Xn3/t19//7Vggf+zYYP/sWKF/69jh/+tZIn/q2WL/6hmjP+mZ47/pGiQ/6Jpkv+gapT/nmuW/72duv+7nbv/mG6c/5Vvnv+TcKD/kXGh/49yo/+Nc6X/i3Sn/4l1qf+Hdqv/hXet/4N4r/+AebH/fnqz/3x7tf96fLb/eH24/3Z+uv90f7z/coC+/3CBwP9tgsL/a4TE/2mFxv/OVGv/y1Vt/8lWb//HV3H/xVhy/8NZdP/BWnb/v1t4/71cev+7XXz/uF5+/7ZfgP+0YIL/smGE/7Bihv+uY4f/rGSJ/6pli/+oZo3/pmeP/6Nokf+haZP/n2qV/51rl/+bbJn/mW2b/5dunP+VcJ7/k3Gg/5Byov+Oc6T/jHSm/4p1qP+Idqr/hnes/4R4rv+CebD/gHqy/357s/97fLX/eX23/3d+uf91f7v/c4C9/3GBv/9vgsH/bYPD/2uExf/PU2r2zVRs/8tVbf/JVm//xldx/8RYc//CWXX/wFp3/75bef+8XXv/ul59/7hff/+2YIH/s2GC/7FihP+vY4b/rWSI/6tliv+pZoz/p2eO/6VokP+jaZL/oGqU/55rlv+cbJf/mm2Z/5hum/+Wb53/lHCf/5Jxof+QcqP/jnOl/4t0p/+Jdan/h3ar/4V3rf+DeK7/gXmw/396sv99e7T/e3y2/3h9uP92frr/dH+8/3KAvv9wgcD/boLC/2yDw/bQU2jazlRq/8xVbP/KVm7/yFdw/8ZYcv/DWXT/wVp2/79beP+9XHr/u118/7leff+3X3//tWCB/7Nhg/+xYoX/rmOH/6xkif+qZYv/qGaN/6Znj/+kaJH/ommS/6BqlP+ea5b/m2yY/5ltmv+Xbpz/lW+e/5NwoP+RcaL/j3Kk/41zpv+LdKj/iXWp/4Z2q/+Ed63/gniv/4B5sf9+erP/fHy1/3p9t/94frn/dn+7/3OAvf9xgb7/b4LA/22DwtrRUmerz1Np/81Ua//LVW3/yVZv/8dXcf/FWHP/w1l1/8Fad/++W3j/vFx6/7pdfP+4Xn7/tl+A/7Rggv+yYYT/sGKG/65jiP+sZIr/qWWM/6dmjf+laI//o2mR/6Fqk/+fa5X/nWyX/5ttmf+Zbpv/lm+d/5Rwn/+ScaH/kHKj/45zpP+MdKb/inWo/4h2qv+Gd6z/g3iu/4F5sP9/erL/fXu0/3t8tv95fbj/d365/3V/u/9zgL3/cYG//26CwavTUWZp0VJo/85Tav/MVWz/ylZu/8hXcP/GWHL/xFlz/8Jadf/AW3f/vlx5/7xde/+5Xn3/t19//7Vggf+zYYP/sWKF/69jh/+tZIj/q2WK/6lmjP+mZ47/pGiQ/6Jpkv+gapT/nmuW/5xsmP+abZr/mG6c/5Zvnv+UcJ//kXGh/49yo/+Nc6X/i3Sn/4l1qf+Hdqv/hXet/4N4r/+BebH/fnqz/3x7tP96fLb/eH24/3Z+uv90f7z/coC+/3CBwGnUUWUX0lJn/9BTaf/OVGv/zFVt/8lWbv/HV3D/xVhy/8NZdP/BWnb/v1t4/71cev+7XXz/uV5+/7dfgP+0YIL/smGE/7Bihf+uY4f/rGSJ/6pli/+oZo3/pmeP/6Rokf+haZP/n2qV/51rl/+bbJn/mW2a/5dunP+Vb57/k3Cg/5Fxov+OcqT/jHSm/4p1qP+Idqr/hnes/4R4rv+Cea//gHqx/357s/98fLX/eX23/3d+uf91f7v/c4C9/3GBvxcAAAAA01FmmtFSaP/PU2n/zVRr/8tVbf/JVm//x1dx/8RYc//CWXX/wFp3/75bef+8XHv/ul19/7hef/+2YID/tGGC/7FihP+vY4b/rWSI/6tliv+pZoz/p2eO/6VokP+jaZL/oWqU/59rlf+cbJf/mm2Z/5hum/+Wb53/lHCf/5Jxof+QcqP/jnOl/4x0p/+Jdan/h3aq/4V3rP+DeK7/gXmw/396sv99e7T/e3y2/3l9uP93frr/dH+8mgAAAAAAAAAA1FFkIdJSZvvQU2j/zlRq/8xVbP/KVm7/yFdw/8ZYcv/EWXT/wlp2/79beP+9XHr/u117/7leff+3X3//tWCB/7Nhg/+xYoX/r2OH/6xkif+qZYv/qGaN/6Znj/+kaJD/ommS/6BqlP+ea5b/nGyY/5ptmv+Xbpz/lW+e/5NwoP+RcaL/j3Kk/41z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";

// HTML 页面模板
const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title data-i18n="page.title">VoiceCraft - AI Voice Workspace</title>
  <meta name="description" content="VoiceCraft is a focused AI voice workspace with 114 voices." data-i18n-content="page.description">
  <meta name="keywords" content="text to speech,AI voice synthesis,online TTS,speech to text,voice transcription" data-i18n-content="page.keywords">
  <link rel="icon" href="/favicon.ico?v=voicecraft-20260627" type="image/x-icon" sizes="any">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --font-display:"Space Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      --font-body:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
      --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
      --radius-sm:0; --radius-md:0; --radius-lg:0; --radius-pill:0;
    }
    :root, [data-theme="light"] {
      --bg:#F4F3EF; --bg-tint:rgba(90,75,224,.05);
      --surface:#FFFFFF; --surface-2:#EFEDE7; --surface-3:#E6E3DB;
      --border:#E4E1D8; --border-strong:#D3CFC4;
      --text:#1A1B1E; --text-2:#585B62; --text-3:#8A8D95;
      --accent:#5A4BE0; --accent-hover:#4838C9; --accent-soft:rgba(90,75,224,.10); --accent-ring:rgba(90,75,224,.22);
      --on-accent:#FFFFFF; --signal:#EE9A3D;
      --error:#CF4436; --error-bg:#FBECEA; --error-border:#F3C9C3; --warning:#9A5B12;
      --shadow-sm:0 1px 2px rgb(20 22 28 / .06),0 1px 3px rgb(20 22 28 / .05);
      --shadow-md:0 14px 34px -14px rgb(20 22 28 / .20);
      --shadow-accent:0 8px 24px -10px rgba(90,75,224,.50);
      color-scheme:light;
    }
    [data-theme="dark"] {
      --bg:#0D1015; --bg-tint:rgba(126,112,247,.07);
      --surface:#161A21; --surface-2:#1B212B; --surface-3:#232A35;
      --border:#2A313D; --border-strong:#3A4350;
      --text:#E8ECF2; --text-2:#9AA2AF; --text-3:#6B7380;
      --accent:#7E70F7; --accent-hover:#6F60F2; --accent-soft:rgba(126,112,247,.16); --accent-ring:rgba(126,112,247,.35);
      --on-accent:#FFFFFF; --signal:#F2B45A;
      --error:#F0796B; --error-bg:rgba(207,68,54,.14); --error-border:rgba(240,121,107,.30); --warning:#E0A451;
      --shadow-sm:0 1px 2px rgb(0 0 0 / .35);
      --shadow-md:0 18px 44px -18px rgb(0 0 0 / .65);
      --shadow-accent:0 8px 28px -10px rgba(126,112,247,.55);
      color-scheme:dark;
    }
    * { box-sizing:border-box; }
    body {
      margin:0; min-height:100vh; color:var(--text); font-family:var(--font-body); line-height:1.5;
      background:var(--bg);
      background-image:radial-gradient(1100px 560px at 100% -8%,var(--bg-tint),transparent 62%);
      -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
      transition:background-color .3s ease,color .3s ease;
    }
    button,input,select,textarea { font:inherit; color:inherit; }
    :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
    .form-input:focus-visible,.form-select:focus-visible,.form-textarea:focus-visible { outline:none; }
    .app-shell { width:min(1200px,calc(100% - 40px)); margin:0 auto; padding:28px 0 48px; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
    .brand { display:flex; align-items:center; gap:13px; }
    .brand-mark { width:44px; height:44px; display:grid; place-items:center; background:linear-gradient(140deg,var(--accent),var(--signal)); box-shadow:var(--shadow-accent); }
    .wave { display:flex; align-items:center; gap:3px; height:20px; }
    .wave i { display:block; width:3px; height:35%; background:var(--on-accent); animation:eq 1.2s ease-in-out infinite; }
    .wave i:nth-child(1){ animation-delay:-.9s } .wave i:nth-child(2){ animation-delay:-.4s } .wave i:nth-child(3){ animation-delay:-.7s } .wave i:nth-child(4){ animation-delay:-.2s } .wave i:nth-child(5){ animation-delay:-.55s }
    @keyframes eq { 0%,100%{ height:22% } 50%{ height:92% } }
    .brand h1 { margin:0; font-family:var(--font-display); font-size:1.4rem; font-weight:700; letter-spacing:-.02em; }
    .brand p { margin:1px 0 0; color:var(--text-2); font-size:.8rem; }
    .topbar-actions { display:flex; align-items:center; gap:10px; }
    .mode-switcher { display:flex; align-items:stretch; gap:4px; padding:4px; height:42px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-md); }
    .mode-btn { display:inline-flex; align-items:center; border:0; background:transparent; color:var(--text-2); padding:0 16px; font-family:var(--font-display); font-weight:600; font-size:.875rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .2s ease,background-color .2s ease,box-shadow .2s ease; }
    .mode-btn:hover { color:var(--text); }
    .mode-btn.active { background:var(--surface); color:var(--accent); box-shadow:var(--shadow-sm); }
    .theme-btn { width:42px; height:42px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:var(--radius-md); cursor:pointer; transition:border-color .2s ease,background-color .2s ease,transform .2s ease; }
    .theme-btn:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .theme-btn:active { transform:scale(.94); }
    .theme-btn svg { width:18px; height:18px; }
    .icon-sun { display:none; } .icon-moon { display:block; }
    [data-theme="dark"] .icon-moon { display:none; } [data-theme="dark"] .icon-sun { display:block; }
    .language-switcher { position:relative; }
    .language-btn { display:inline-flex; align-items:center; gap:7px; height:42px; padding:0 13px; border:1px solid var(--border); background:var(--surface); color:var(--text); border-radius:var(--radius-md); font-weight:600; font-size:.875rem; cursor:pointer; transition:border-color .2s ease,background-color .2s ease; }
    .language-btn:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .language-dropdown { position:absolute; right:0; top:calc(100% + 8px); z-index:10; min-width:160px; display:none; padding:6px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:var(--shadow-md); }
    .language-dropdown.show { display:grid; gap:2px; }
    .language-option { border-radius:var(--radius-sm); padding:9px 11px; cursor:pointer; color:var(--text-2); font-size:.875rem; transition:background-color .15s ease,color .15s ease; }
    .language-option:hover,.language-option.active { background:var(--accent-soft); color:var(--text); }
    .workspace-grid { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(330px,.85fr); gap:18px; align-items:start; }
    .input-panel,.voice-panel,.transcription-panel { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:24px; transition:border-color .2s ease,box-shadow .2s ease; }
    .panel-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
    .panel-header h2 { margin:0; font-family:var(--font-display); font-size:1.08rem; font-weight:600; letter-spacing:-.01em; }
    .panel-header p { margin:4px 0 0; color:var(--text-2); font-size:.85rem; line-height:1.45; }
    .voice-count { flex-shrink:0; font-family:var(--font-mono); font-size:.72rem; color:var(--text-2); background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius-pill); padding:4px 11px; white-space:nowrap; }
    .form-group { margin-bottom:18px; }
    .form-label { display:block; margin-bottom:8px; font-weight:600; font-size:.8rem; letter-spacing:.01em; }
    .field-label-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
    .field-label-row .form-label { margin-bottom:0; }
    .inline-action { min-height:34px; padding:6px 10px; border-radius:var(--radius-sm); font-size:.78rem; }
    .form-input,.form-select,.form-textarea { width:100%; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:11px 13px; outline:none; transition:border-color .15s ease,box-shadow .15s ease; }
    .form-input::placeholder,.form-textarea::placeholder { color:var(--text-3); }
    .form-input:focus,.form-select:focus,.form-textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-ring); }
    .form-select { cursor:pointer; }
    .form-textarea { min-height:240px; resize:vertical; line-height:1.6; }
    .transcription-panel .form-textarea { min-height:160px; }
    .input-method-tabs { display:flex; gap:8px; }
    .tab-btn { border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:8px 14px; font-weight:600; font-size:.82rem; border-radius:var(--radius-sm); cursor:pointer; transition:color .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease; }
    .tab-btn:hover { color:var(--text); border-color:var(--border-strong); }
    .tab-btn.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); box-shadow:var(--shadow-accent); }
    .file-drop-zone,.audio-upload-zone { border:1.5px dashed var(--border-strong); border-radius:var(--radius-md); background:var(--surface-2); padding:28px; text-align:center; cursor:pointer; transition:border-color .2s ease,background-color .2s ease; }
    .file-drop-zone:hover,.audio-upload-zone:hover,.file-drop-zone.dragover,.audio-upload-zone.dragover { border-color:var(--accent); background:var(--accent-soft); }
    .file-drop-text { margin:0; font-weight:600; }
    .file-drop-hint { margin:6px 0 0; color:var(--text-2); font-size:.82rem; }
    .textarea-shell { position:relative; }
    .textarea-shell .form-textarea { display:block; padding-bottom:172px; }
    .ssml-ghost-example { position:absolute; left:13px; right:13px; bottom:34px; max-height:112px; margin:0; padding:10px 0 0; border-top:1px solid var(--border); color:var(--text-3); font-family:var(--font-mono); font-size:.76rem; line-height:1.45; white-space:pre-wrap; overflow:hidden; overflow-wrap:anywhere; pointer-events:none; opacity:.72; transition:opacity .15s ease; }
    .textarea-shell.has-value .ssml-ghost-example { opacity:0; }
    .file-info { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:11px 13px; background:var(--surface-2); }
    .file-details { display:grid; gap:2px; min-width:0; }
    .file-name { font-weight:600; overflow-wrap:anywhere; }
    .file-size { color:var(--text-2); font-size:.78rem; font-family:var(--font-mono); }
    .file-remove-btn { flex-shrink:0; border:0; background:var(--error); color:#fff; width:30px; height:30px; border-radius:var(--radius-sm); cursor:pointer; font-size:1.15rem; line-height:1; transition:opacity .15s ease; }
    .file-remove-btn:hover { opacity:.85; }
    .controls-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; align-items:start; }
    .controls-grid > .form-group { margin-bottom:0; display:grid; gap:9px; align-content:start; }
    .controls-grid .form-label { margin-bottom:0; }
    .controls-grid .control-label-row, .controls-grid > .form-group > .form-label { min-height:30px; display:flex; align-items:center; }
    .range-control { display:grid; gap:9px; }
    .control-label-row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .range-value { flex-shrink:0; min-width:54px; text-align:right; font-family:var(--font-mono); font-size:.8rem; color:var(--text); background:var(--surface-2); border:1px solid var(--border); padding:3px 8px; }
    .form-range { width:100%; accent-color:var(--accent); cursor:pointer; }
    .range-scale { display:flex; justify-content:space-between; color:var(--text-2); font-size:.75rem; }
    .btn-primary,.btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:0; border-radius:var(--radius-md); font-family:var(--font-display); font-weight:600; text-decoration:none; cursor:pointer; transition:background-color .2s ease,transform .15s ease,box-shadow .2s ease,border-color .2s ease; }
    .btn-primary { width:100%; min-height:48px; margin-top:4px; background:var(--accent); color:var(--on-accent); padding:13px 18px; font-size:.95rem; box-shadow:var(--shadow-accent); }
    .btn-primary:hover:not(:disabled) { background:var(--accent-hover); transform:translateY(-1px); }
    .btn-primary:active:not(:disabled) { transform:translateY(0); }
    .btn-primary:disabled { opacity:.55; cursor:not-allowed; box-shadow:none; }
    .btn-secondary { background:var(--surface-2); color:var(--text); padding:10px 14px; border:1px solid var(--border); font-size:.85rem; }
    .btn-secondary:hover { background:var(--surface-3); border-color:var(--border-strong); }
    .filter-group { display:flex; flex-wrap:wrap; gap:7px; margin:12px 0; }
    .filter-chip { border:1px solid var(--border); background:var(--surface-2); color:var(--text-2); padding:6px 13px; font-weight:600; font-size:.78rem; border-radius:var(--radius-pill); cursor:pointer; transition:color .18s ease,background-color .18s ease,border-color .18s ease; }
    .filter-chip:hover { color:var(--text); border-color:var(--border-strong); }
    .filter-chip.active { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
    .selected-voice { margin:14px 0 12px; padding:10px 13px; background:var(--accent-soft); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius-sm); color:var(--text); font-size:.8rem; overflow-wrap:anywhere; }
    .voice-list { display:grid; gap:9px; max-height:430px; overflow:auto; padding:2px; margin:0 -2px; }
    .voice-list::-webkit-scrollbar { width:8px; }
    .voice-list::-webkit-scrollbar-thumb { background:var(--border-strong); }
    .voice-list::-webkit-scrollbar-track { background:transparent; }
    .voice-item { position:relative; display:grid; gap:3px; width:100%; border:1px solid var(--border); background:var(--surface); color:var(--text); padding:12px 14px; text-align:left; border-radius:var(--radius-md); cursor:pointer; transition:border-color .15s ease,background-color .15s ease,transform .15s ease; }
    .voice-item:hover { border-color:var(--border-strong); background:var(--surface-2); }
    .voice-item.active { border-color:var(--accent); background:var(--accent-soft); }
    .voice-item.active::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--accent); }
    .voice-name { font-weight:600; font-size:.92rem; }
    .voice-meta { color:var(--text-2); font-size:.78rem; }
    .voice-id { color:var(--text-3); font-size:.72rem; font-family:var(--font-mono); overflow-wrap:anywhere; }
    .empty-state { color:var(--warning); font-size:.85rem; padding:8px 0; }
    .result-container { display:none; margin-top:18px; border:1px solid var(--border); border-radius:var(--radius-md); background:var(--surface-2); padding:16px; }
    .loading-container { text-align:center; color:var(--text-2); padding:8px; }
    .loading-spinner { width:30px; height:30px; margin:0 auto 12px; border-radius:50%; border:3px solid var(--border); border-top-color:var(--accent); animation:spin 1s linear infinite; }
    .loading-text { margin:0 0 4px; font-weight:600; color:var(--text); }
    .progress-info { font-size:.78rem; color:var(--text-2); font-family:var(--font-mono); }
    .audio-player { width:100%; margin-bottom:12px; }
    .error-message { color:var(--error); background:var(--error-bg); border:1px solid var(--error-border); border-radius:var(--radius-sm); padding:12px 14px; font-size:.88rem; }
    .token-config { display:flex; flex-wrap:wrap; gap:14px; }
    .token-config label { display:inline-flex; align-items:center; gap:7px; font-size:.85rem; color:var(--text-2); cursor:pointer; }
    .token-config input[type=radio] { accent-color:var(--accent); }
    .result-actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
    .workspace-grid { grid-template-columns:minmax(0,1fr) 360px; align-items:stretch; height:clamp(640px,calc(100dvh - 112px),760px); }
    .input-panel,.voice-panel { height:100%; min-height:0; overflow:hidden; }
    .input-panel { display:flex; flex-direction:column; }
    .input-panel > .panel-header { flex:0 0 auto; }
    .input-panel > .form-group,.input-panel > .controls-grid,.input-panel > .btn-primary { flex:0 0 auto; }
    .input-panel > .result-container { flex:1 1 auto; min-height:96px; overflow:auto; }
    .form-group { margin-bottom:16px; }
    .panel-header { min-height:54px; margin-bottom:18px; }
    .form-textarea { height:248px; min-height:248px; resize:none; }
    .transcription-panel .form-textarea { height:180px; min-height:180px; }
    .file-drop-zone,.audio-upload-zone { min-height:248px; display:grid; align-content:center; justify-items:center; }
    .voice-panel { display:grid; grid-template-rows:auto auto auto auto auto minmax(0,1fr) auto; gap:10px; padding:20px; }
    .voice-panel .panel-header,.voice-panel .voice-search,.voice-panel .filter-group,.voice-panel .selected-voice { margin:0; }
    .voice-panel .panel-header { min-height:0; align-items:center; }
    .voice-panel .panel-header p { display:none; }
    .voice-panel .voice-search { display:grid; gap:7px; }
    .voice-panel .filter-group { flex-wrap:nowrap; overflow-x:auto; overflow-y:hidden; min-height:34px; padding-bottom:2px; scrollbar-width:thin; }
    .voice-panel .filter-chip { flex:0 0 auto; white-space:nowrap; padding:5px 10px; font-size:.74rem; }
    .selected-voice { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:8px 11px; }
    .voice-list { max-height:none; min-height:0; height:100%; gap:7px; overflow:auto; padding:2px; margin:0 -2px; }
    .voice-item { min-height:58px; padding:10px 12px; gap:2px; }
    .voice-name { font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .voice-meta { font-size:.75rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .voice-id { display:none; }
    .empty-state { margin:0; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion:reduce) {
      *,*::before,*::after { animation-duration:.001ms!important; animation-iteration-count:1!important; transition-duration:.001ms!important; }
      .wave i { height:55%; }
    }
    @media (max-width:880px) {
      .app-shell { width:min(100% - 28px,720px); padding-top:18px; }
      .topbar { flex-direction:column; align-items:stretch; gap:14px; }
      .topbar-actions { justify-content:space-between; }
      .mode-switcher { flex:1; } .mode-btn { flex:1; }
      .workspace-grid,.controls-grid { grid-template-columns:1fr; }
      .workspace-grid { height:auto; }
      .input-panel,.voice-panel { height:auto; overflow:visible; }
      .voice-panel { display:block; }
      .voice-panel .panel-header p { display:block; }
      .voice-panel .filter-group { flex-wrap:wrap; overflow:visible; }
      .voice-list { height:auto; max-height:420px; }
      .panel-header { flex-direction:column; }
      .form-textarea { height:220px; min-height:220px; }
      .file-drop-zone,.audio-upload-zone { min-height:220px; }
    }
  </style>
  <script>(function(){try{var t=localStorage.getItem('voicecraft-theme');if(!t){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();</script>
</head>
<body>
  <div class="toast-host" id="toastHost" aria-live="assertive" aria-atomic="true"></div>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true"><span class="wave"><i></i><i></i><i></i><i></i><i></i></span></span><div><h1 data-i18n="header.title">VoiceCraft</h1><p data-i18n="header.subtitle">AI voice workspace</p></div></div>
      <div class="topbar-actions">
        <div class="mode-switcher" role="tablist" aria-label="VoiceCraft mode"><button type="button" class="mode-btn active" id="ttsMode" role="tab" aria-selected="true"><span data-i18n="mode.tts">Text to Speech</span></button><button type="button" class="mode-btn" id="transcriptionMode" role="tab" aria-selected="false"><span data-i18n="mode.transcription">Speech to Text</span></button></div>
        <button type="button" class="theme-btn" id="themeBtn" aria-label="Toggle color theme" title="Toggle theme"><svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg><svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button>
        <div class="language-switcher"><button type="button" class="language-btn" id="languageBtn" aria-haspopup="listbox" aria-expanded="false"><span id="currentLangFlag">🌐</span><span id="currentLangName" data-i18n="lang.current">English</span></button><div class="language-dropdown" id="languageDropdown" role="listbox" aria-label="Language"><div class="language-option" data-lang="en">English</div><div class="language-option" data-lang="zh">中文</div><div class="language-option" data-lang="ja">日本語</div><div class="language-option" data-lang="ko">한국어</div><div class="language-option" data-lang="es">Español</div><div class="language-option" data-lang="fr">Français</div><div class="language-option" data-lang="de">Deutsch</div><div class="language-option" data-lang="ru">Русский</div></div></div>
      </div>
    </header>
    <main class="workspace">
      <section class="workspace-grid" id="ttsWorkspace">
        <form id="ttsForm" class="input-panel">
          <div class="panel-header"><div><h2 data-i18n="tts.title">Text to Speech</h2><p data-i18n="tts.subtitle">Write or upload text, tune the voice, then generate an MP3.</p></div></div>
          <div class="form-group"><label class="form-label" data-i18n="input.method">Input method</label><div class="input-method-tabs"><button type="button" class="tab-btn active" id="textInputTab" data-i18n="input.manual">Manual text</button><button type="button" class="tab-btn" id="fileUploadTab" data-i18n="input.upload">Upload txt</button><button type="button" class="tab-btn" id="ssmlInputTab" data-i18n="input.ssml">SSML</button></div></div>
          <div class="form-group" id="textInputArea"><label class="form-label" for="text" data-i18n="input.text">Input text</label><textarea class="form-textarea" id="text" placeholder="请输入要转换为语音的文本内容..." data-i18n-placeholder="input.textPlaceholder" required></textarea><span id="textCounter" class="char-counter" aria-hidden="true"></span></div>
          <div class="form-group" id="fileUploadArea" style="display:none"><label class="form-label" for="fileInput" data-i18n="input.file">Upload txt file</label><div class="file-drop-zone" id="fileDropZone" role="button" tabindex="0" aria-label="Upload txt file, drop or activate to choose"><p class="file-drop-text" data-i18n="input.fileDrop">Drop a txt file here, or click to choose</p><p class="file-drop-hint" data-i18n="input.fileHint">TXT only, max 500KB</p><input type="file" id="fileInput" accept=".txt,text/plain" style="display:none"></div><div class="file-info" id="fileInfo" style="display:none"><div class="file-details"><span class="file-name" id="fileName"></span><span class="file-size" id="fileSize"></span></div><button type="button" class="file-remove-btn" id="fileRemoveBtn">×</button></div></div>
          <div class="form-group" id="ssmlInputArea" style="display:none"><div class="field-label-row"><label class="form-label" for="ssml" data-i18n="input.ssmlText">SSML input</label><button type="button" class="btn-secondary inline-action" id="useSsmlExampleBtn" data-i18n="input.useSsmlExample">Use example</button></div><div class="textarea-shell" id="ssmlTextareaShell"><textarea class="form-textarea" id="ssml" placeholder="<speak version='1.0' xml:lang='zh-CN'>..." data-i18n-placeholder="input.ssmlPlaceholder"></textarea><pre class="ssml-ghost-example" aria-hidden="true"><code id="ssmlExampleCode"></code></pre></div><p class="file-drop-hint" data-i18n="input.ssmlHint">Paste complete SSML. Voice, speed, pitch, and style controls are ignored in SSML mode.</p></div>
          <div class="controls-grid"><div class="form-group range-control"><div class="control-label-row"><label class="form-label" for="speed" data-i18n="control.speed">Speed</label><span class="range-value" id="speedValue">1.00x</span></div><input class="form-range" id="speed" type="range" min="0.5" max="2" step="0.05" value="1" aria-describedby="speedScale"><div class="range-scale" id="speedScale"><span data-i18n="control.speedMin">Slow</span><span data-i18n="control.speedMax">Fast</span></div></div><div class="form-group range-control"><div class="control-label-row"><label class="form-label" for="pitch" data-i18n="control.pitch">Pitch</label><span class="range-value" id="pitchValue">+0</span></div><input class="form-range" id="pitch" type="range" min="-50" max="50" step="1" value="0" aria-describedby="pitchScale"><div class="range-scale" id="pitchScale"><span data-i18n="control.pitchMin">Low</span><span data-i18n="control.pitchMax">High</span></div></div><div class="form-group"><label class="form-label" for="style" data-i18n="control.style">Style</label><select class="form-select" id="style"><option value="general" selected data-i18n="style.general">General</option><option value="assistant" data-i18n="style.assistant">Assistant</option><option value="chat" data-i18n="style.chat">Chat</option><option value="customerservice" data-i18n="style.customerservice">Customer service</option><option value="newscast" data-i18n="style.newscast">Newscast</option><option value="affectionate" data-i18n="style.affectionate">Affectionate</option><option value="calm" data-i18n="style.calm">Calm</option><option value="cheerful" data-i18n="style.cheerful">Cheerful</option><option value="gentle" data-i18n="style.gentle">Gentle</option><option value="lyrical" data-i18n="style.lyrical">Lyrical</option><option value="serious" data-i18n="style.serious">Serious</option></select></div></div>
          <button type="submit" class="btn-primary" id="generateBtn"><span data-i18n="action.generate">Generate voice</span></button>
          <div id="result" class="result-container"><div id="loading" class="loading-container" style="display:none" aria-live="polite"><div class="loading-spinner"></div><p class="loading-text" id="loadingText">Generating voice...</p><div class="progress-info" id="progressInfo"></div></div><div id="success" style="display:none"><audio id="audioPlayer" class="audio-player" controls></audio><a id="downloadBtn" class="btn-secondary" download="speech.mp3">Download MP3</a></div><div id="error" class="error-message" style="display:none" role="alert"></div></div>
        </form>
        <aside class="voice-panel"><div class="panel-header"><div><h2 data-i18n="voice.title">Voice Library</h2><p data-i18n="voice.subtitle">Search 114 Edge voices by name, locale, gender, or ID.</p></div><span class="voice-count" id="voiceCount">114 voices</span></div><div class="voice-search"><label class="form-label" for="voiceSearch" data-i18n="voice.search">Search voices</label><input class="form-input" id="voiceSearch" type="search" placeholder="Xiaoxiao, Jenny, zh-CN, en-US..." data-i18n-placeholder="voice.searchPlaceholder" autocomplete="off"></div><div class="filter-group" id="voiceLanguageFilters" aria-label="Language filters"></div><div class="filter-group" id="voiceGenderFilters" aria-label="Gender filters"></div><input type="hidden" id="selectedVoiceId" value="zh-CN-XiaoxiaoNeural"><p class="selected-voice" id="selectedVoiceSummary">Selected: zh-CN-XiaoxiaoNeural</p><div class="voice-list" id="voiceList" role="listbox" aria-label="Voice options"></div><p class="empty-state" id="voiceEmptyState" style="display:none" data-i18n="voice.empty">No voices match your search.</p></aside>
      </section>
      <section class="transcription-panel" id="transcriptionContainer" style="display:none">
        <form id="transcriptionForm"><div class="panel-header"><div><h2 data-i18n="stt.title">Speech to Text</h2><p data-i18n="stt.subtitle">Upload audio and transcribe it with the existing API flow.</p></div></div><div class="form-group"><label class="form-label" data-i18n="stt.upload">Upload audio file</label><div class="audio-upload-zone" id="audioDropZone" role="button" tabindex="0" aria-label="Upload audio file, drop or activate to choose"><p class="file-drop-text" data-i18n="stt.fileDrop">Drop an audio file here, or click to choose</p><p class="file-drop-hint" data-i18n="stt.fileHint">mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max 10MB</p><input type="file" id="audioFileInput" accept=".mp3,.wav,.m4a,.flac,.aac,.ogg,.webm,.amr,.3gp,audio/*" style="display:none"></div><div class="file-info" id="audioFileInfo" style="display:none"><div class="file-details"><span class="file-name" id="audioFileName"></span><span class="file-size" id="audioFileSize"></span></div><button type="button" class="file-remove-btn" id="audioFileRemoveBtn">×</button></div></div><div class="form-group"><label class="form-label" for="tokenInput" data-i18n="token.title">API Token</label><div class="token-config"><label><input type="radio" name="tokenOption" value="default" checked> <span data-i18n="token.default">Use default token</span></label><label><input type="radio" name="tokenOption" value="custom"> <span data-i18n="token.custom">Use custom SiliconFlow token</span></label></div><input type="password" class="form-input" id="tokenInput" placeholder="Enter API token" data-i18n-placeholder="token.placeholder" style="display:none;margin-top:10px"></div><button type="submit" class="btn-primary" id="transcribeBtn"><span data-i18n="action.transcribe">Transcribe audio</span></button></form>
        <div id="transcriptionResult" class="result-container"><div id="transcriptionLoading" class="loading-container" style="display:none" aria-live="polite"><div class="loading-spinner"></div><p class="loading-text" id="transcriptionLoadingText">Transcribing audio...</p><div class="progress-info" id="transcriptionProgressInfo"></div></div><div id="transcriptionSuccess" style="display:none"><div class="transcription-result"><label class="form-label" for="transcriptionText" data-i18n="stt.result">Transcription result</label><textarea class="form-textarea" id="transcriptionText" placeholder="Transcription result appears here..." data-i18n-placeholder="stt.resultPlaceholder" readonly></textarea><div class="result-actions"><button type="button" class="btn-secondary" id="copyTranscriptionBtn" data-i18n="action.copy">Copy text</button><button type="button" class="btn-secondary" id="editTranscriptionBtn" data-i18n="action.edit">Edit text</button><button type="button" class="btn-secondary" id="useForTtsBtn" data-i18n="action.useForTts">Use for TTS</button></div></div></div><div id="transcriptionError" class="error-message" style="display:none" role="alert"></div></div>
      </section>
    </main>
  </div>
  <script>
    const VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", name: "晓晓 Xiaoxiao", locale: "zh-CN", language: "Chinese", gender: "Female", description: "温柔" },
  { id: "zh-CN-YunxiNeural", name: "云希 Yunxi", locale: "zh-CN", language: "Chinese", gender: "Male", description: "清朗" },
  { id: "zh-CN-YunyangNeural", name: "云扬 Yunyang", locale: "zh-CN", language: "Chinese", gender: "Male", description: "阳光" },
  { id: "zh-CN-XiaoyiNeural", name: "晓伊 Xiaoyi", locale: "zh-CN", language: "Chinese", gender: "Female", description: "甜美" },
  { id: "zh-CN-YunjianNeural", name: "云健 Yunjian", locale: "zh-CN", language: "Chinese", gender: "Male", description: "稳重" },
  { id: "zh-CN-XiaochenNeural", name: "晓辰 Xiaochen", locale: "zh-CN", language: "Chinese", gender: "Female", description: "知性" },
  { id: "zh-CN-XiaohanNeural", name: "晓涵 Xiaohan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "优雅" },
  { id: "zh-CN-XiaomengNeural", name: "晓梦 Xiaomeng", locale: "zh-CN", language: "Chinese", gender: "Female", description: "梦幻" },
  { id: "zh-CN-XiaomoNeural", name: "晓墨 Xiaomo", locale: "zh-CN", language: "Chinese", gender: "Female", description: "文艺" },
  { id: "zh-CN-XiaoqiuNeural", name: "晓秋 Xiaoqiu", locale: "zh-CN", language: "Chinese", gender: "Female", description: "成熟" },
  { id: "zh-CN-XiaoruiNeural", name: "晓睿 Xiaorui", locale: "zh-CN", language: "Chinese", gender: "Female", description: "智慧" },
  { id: "zh-CN-XiaoshuangNeural", name: "晓双 Xiaoshuang", locale: "zh-CN", language: "Chinese", gender: "Female", description: "活泼" },
  { id: "zh-CN-XiaoxuanNeural", name: "晓萱 Xiaoxuan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "清新" },
  { id: "zh-CN-XiaoyanNeural", name: "晓颜 Xiaoyan", locale: "zh-CN", language: "Chinese", gender: "Female", description: "柔美" },
  { id: "zh-CN-XiaoyouNeural", name: "晓悠 Xiaoyou", locale: "zh-CN", language: "Chinese", gender: "Female", description: "悠扬" },
  { id: "zh-CN-XiaozhenNeural", name: "晓甄 Xiaozhen", locale: "zh-CN", language: "Chinese", gender: "Female", description: "端庄" },
  { id: "zh-CN-YunfengNeural", name: "云枫 Yunfeng", locale: "zh-CN", language: "Chinese", gender: "Male", description: "磁性" },
  { id: "zh-CN-YunhaoNeural", name: "云皓 Yunhao", locale: "zh-CN", language: "Chinese", gender: "Male", description: "豪迈" },
  { id: "zh-CN-YunxiaNeural", name: "云夏 Yunxia", locale: "zh-CN", language: "Chinese", gender: "Male", description: "热情" },
  { id: "zh-CN-YunyeNeural", name: "云野 Yunye", locale: "zh-CN", language: "Chinese", gender: "Male", description: "野性" },
  { id: "zh-CN-YunzeNeural", name: "云泽 Yunze", locale: "zh-CN", language: "Chinese", gender: "Male", description: "深沉" },
  { id: "en-US-JennyNeural", name: "Jenny", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-GuyNeural", name: "Guy", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AriaNeural", name: "Aria", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-DavisNeural", name: "Davis", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AmberNeural", name: "Amber", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-AnaNeural", name: "Ana", locale: "en-US", language: "English", gender: "Female", description: "Child, US" },
  { id: "en-US-AndrewNeural", name: "Andrew", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-AshleyNeural", name: "Ashley", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-BrandonNeural", name: "Brandon", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-ChristopherNeural", name: "Christopher", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-CoraNeural", name: "Cora", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-ElizabethNeural", name: "Elizabeth", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-EricNeural", name: "Eric", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-JacobNeural", name: "Jacob", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-JaneNeural", name: "Jane", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-JasonNeural", name: "Jason", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-MichelleNeural", name: "Michelle", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-MonicaNeural", name: "Monica", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-NancyNeural", name: "Nancy", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-RogerNeural", name: "Roger", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-SaraNeural", name: "Sara", locale: "en-US", language: "English", gender: "Female", description: "US" },
  { id: "en-US-SteffanNeural", name: "Steffan", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-US-TonyNeural", name: "Tony", locale: "en-US", language: "English", gender: "Male", description: "US" },
  { id: "en-GB-SoniaNeural", name: "Sonia", locale: "en-GB", language: "English", gender: "Female", description: "UK" },
  { id: "en-GB-RyanNeural", name: "Ryan", locale: "en-GB", language: "English", gender: "Male", description: "UK" },
  { id: "en-GB-LibbyNeural", name: "Libby", locale: "en-GB", language: "English", gender: "Female", description: "UK" },
  { id: "en-GB-MaisieNeural", name: "Maisie", locale: "en-GB", language: "English", gender: "Female", description: "Child, UK" },
  { id: "en-AU-NatashaNeural", name: "Natasha", locale: "en-AU", language: "English", gender: "Female", description: "AU" },
  { id: "en-AU-WilliamNeural", name: "William", locale: "en-AU", language: "English", gender: "Male", description: "AU" },
  { id: "ja-JP-NanamiNeural", name: "Nanami 七海", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-KeitaNeural", name: "Keita 圭太", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-AoiNeural", name: "Aoi 葵", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-DaichiNeural", name: "Daichi 大地", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-MayuNeural", name: "Mayu 真由", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ja-JP-NaokiNeural", name: "Naoki 直樹", locale: "ja-JP", language: "Japanese", gender: "Male", description: "" },
  { id: "ja-JP-ShioriNeural", name: "Shiori 栞", locale: "ja-JP", language: "Japanese", gender: "Female", description: "" },
  { id: "ko-KR-SunHiNeural", name: "SunHi 선희", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-InJoonNeural", name: "InJoon 인준", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-BongJinNeural", name: "BongJin 봉진", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-GookMinNeural", name: "GookMin 국민", locale: "ko-KR", language: "Korean", gender: "Male", description: "" },
  { id: "ko-KR-JiMinNeural", name: "JiMin 지민", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-SeoHyeonNeural", name: "SeoHyeon 서현", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-SoonBokNeural", name: "SoonBok 순복", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "ko-KR-YuJinNeural", name: "YuJin 유진", locale: "ko-KR", language: "Korean", gender: "Female", description: "" },
  { id: "fr-FR-DeniseNeural", name: "Denise", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-HenriNeural", name: "Henri", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-EloiseNeural", name: "Eloise", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-AlainNeural", name: "Alain", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-BrigitteNeural", name: "Brigitte", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-CelesteNeural", name: "Celeste", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-ClaudeNeural", name: "Claude", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-CoraliNeural", name: "Corali", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-JacquelineNeural", name: "Jacqueline", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-JeromeNeural", name: "Jerome", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-JosephineNeural", name: "Josephine", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "fr-FR-MauriceNeural", name: "Maurice", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-YvesNeural", name: "Yves", locale: "fr-FR", language: "French", gender: "Male", description: "" },
  { id: "fr-FR-YvetteNeural", name: "Yvette", locale: "fr-FR", language: "French", gender: "Female", description: "" },
  { id: "de-DE-KatjaNeural", name: "Katja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-ConradNeural", name: "Conrad", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-AmalaNeural", name: "Amala", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-BerndNeural", name: "Bernd", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-ChristophNeural", name: "Christoph", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-ElkeNeural", name: "Elke", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-GiselaNeural", name: "Gisela", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-KasperNeural", name: "Kasper", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-KillianNeural", name: "Killian", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-KlarissaNeural", name: "Klarissa", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-KlausNeural", name: "Klaus", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-LouisaNeural", name: "Louisa", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-MajaNeural", name: "Maja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "de-DE-RalfNeural", name: "Ralf", locale: "de-DE", language: "German", gender: "Male", description: "" },
  { id: "de-DE-TanjaNeural", name: "Tanja", locale: "de-DE", language: "German", gender: "Female", description: "" },
  { id: "es-ES-ElviraNeural", name: "Elvira", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-AlvaroNeural", name: "Alvaro", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-AbrilNeural", name: "Abril", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-ArnauNeural", name: "Arnau", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-DarioNeural", name: "Dario", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-EliasNeural", name: "Elias", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-EstrellaNeural", name: "Estrella", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-IreneNeural", name: "Irene", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-LaiaNeural", name: "Laia", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-LiaNeural", name: "Lia", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-NilNeural", name: "Nil", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-SaulNeural", name: "Saul", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-TeoNeural", name: "Teo", locale: "es-ES", language: "Spanish", gender: "Male", description: "" },
  { id: "es-ES-TrianaNeural", name: "Triana", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-ES-VeraNeural", name: "Vera", locale: "es-ES", language: "Spanish", gender: "Female", description: "" },
  { id: "es-MX-DaliaNeural", name: "Dalia", locale: "es-MX", language: "Spanish", gender: "Female", description: "MX" },
  { id: "es-MX-JorgeNeural", name: "Jorge", locale: "es-MX", language: "Spanish", gender: "Male", description: "MX" },
  { id: "ru-RU-SvetlanaNeural", name: "Svetlana Светлана", locale: "ru-RU", language: "Russian", gender: "Female", description: "" },
  { id: "ru-RU-DmitryNeural", name: "Dmitry Дмитрий", locale: "ru-RU", language: "Russian", gender: "Male", description: "" },
  { id: "ru-RU-DariyaNeural", name: "Dariya Дарья", locale: "ru-RU", language: "Russian", gender: "Female", description: "" }
    ];
    let selectedFile = null;
    let currentInputMethod = 'text';
    let currentMode = 'tts';
    let selectedAudioFile = null;
    let currentLanguage = 'en';
    let selectedVoiceId = 'zh-CN-XiaoxiaoNeural';
    let activeLanguageFilter = 'All';
    let activeGenderFilter = 'All';
    let voiceSearchTimer = null;
    const CONFIG = { SEARCH_DEBOUNCE: 120, COPY_FEEDBACK: 1500, MAX_TEXT_LENGTH: 10000 };
    const SSML_EXAMPLE = [
      '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN">',
      '  <voice name="zh-CN-XiaoxiaoNeural">',
      '    <mstts:express-as style="cheerful">',
      '      <prosody rate="+10%" pitch="+2Hz">你好，这是一个 SSML 示例。</prosody>',
      '    </mstts:express-as>',
      '  </voice>',
      '</speak>'
    ].join('\\n');
    const translations = {
      en: {
        'page.title': 'VoiceCraft - AI Voice Workspace',
        'page.description': 'VoiceCraft is a focused AI voice workspace with 114 voices.',
        'page.keywords': 'text to speech,AI voice synthesis,online TTS,speech to text,voice transcription',
        'lang.current': 'English',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI voice workspace',
        'mode.tts': 'Text to Speech',
        'mode.transcription': 'Speech to Text',
        'tts.title': 'Text to Speech',
        'tts.subtitle': 'Write or upload text, tune the voice, then generate an MP3.',
        'input.method': 'Input method',
        'input.manual': 'Manual text',
        'input.upload': 'Upload txt',
        'input.ssml': 'SSML',
        'input.ssmlText': 'SSML input',
        'input.ssmlPlaceholder': 'Paste complete SSML here...',
        'input.ssmlHint': 'Paste complete SSML. Voice, speed, pitch, and style controls are ignored in SSML mode.',
        'input.useSsmlExample': 'Use example',
        'input.text': 'Input text',
        'input.textPlaceholder': 'Enter text to convert to speech...',
        'input.file': 'Upload txt file',
        'input.fileDrop': 'Drop a txt file here, or click to choose',
        'input.fileHint': 'TXT only, max 500KB',
        'control.speed': 'Speed',
        'control.pitch': 'Pitch',
        'control.style': 'Style',
        'control.speedMin': 'Slow',
        'control.speedMax': 'Fast',
        'control.pitchMin': 'Low',
        'control.pitchMax': 'High',
        'style.general': 'General',
        'style.assistant': 'Assistant',
        'style.chat': 'Chat',
        'style.customerservice': 'Customer service',
        'style.newscast': 'Newscast',
        'style.affectionate': 'Affectionate',
        'style.calm': 'Calm',
        'style.cheerful': 'Cheerful',
        'style.gentle': 'Gentle',
        'style.lyrical': 'Lyrical',
        'style.serious': 'Serious',
        'voice.title': 'Voice Library',
        'voice.subtitle': 'Search 114 Edge voices by name, locale, gender, or ID.',
        'voice.search': 'Search voices',
        'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...',
        'voice.empty': 'No voices match your search.',
        'voice.selected': 'Selected',
        'stt.title': 'Speech to Text',
        'stt.subtitle': 'Upload audio and transcribe it with the existing API flow.',
        'stt.upload': 'Upload audio file',
        'stt.fileDrop': 'Drop an audio file here, or click to choose',
        'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max 10MB',
        'stt.result': 'Transcription result',
        'stt.resultPlaceholder': 'Transcription result appears here...',
        'token.title': 'API Token',
        'token.default': 'Use default token',
        'token.custom': 'Use custom SiliconFlow token',
        'token.placeholder': 'Enter API token',
        'action.generate': 'Generate voice',
        'action.transcribe': 'Transcribe audio',
        'action.copy': 'Copy text',
        'action.edit': 'Edit text',
        'action.save': 'Save edit',
        'action.copied': 'Copied',
        'action.useForTts': 'Use for TTS',
        'status.generating': 'Generating...',
        'status.longText': 'Processing long text...',
        'status.file': 'Processing uploaded file...',
        'status.ssml': 'Processing SSML...',
        'status.transcribing': 'Transcribing...'
      },
      zh: {
        'page.title': 'VoiceCraft - AI 语音工作台',
        'page.description': 'VoiceCraft 是一个 AI 语音工作台，支持 114 种声音。',
        'page.keywords': '文字转语音,AI语音合成,在线TTS,语音转文字,语音转录',
        'lang.current': '中文',
        'header.title': 'VoiceCraft',
        'header.subtitle': 'AI 语音工作台',
        'mode.tts': '文字转语音',
        'mode.transcription': '语音转文字',
        'tts.title': '文字转语音',
        'tts.subtitle': '输入或上传文本，选择声音和参数后生成 MP3。',
        'input.method': '输入方式',
        'input.manual': '手动输入',
        'input.upload': '上传 txt',
        'input.ssml': 'SSML',
        'input.ssmlText': 'SSML 输入',
        'input.ssmlPlaceholder': '在这里粘贴完整 SSML...',
        'input.ssmlHint': '粘贴完整 SSML。SSML 模式会忽略声音、语速、音调和风格控件。',
        'input.useSsmlExample': '填充示例',
        'input.text': '输入文本',
        'input.textPlaceholder': '请输入要转换为语音的文本内容...',
        'input.file': '上传 txt 文件',
        'input.fileDrop': '拖拽 txt 文件到此处，或点击选择',
        'input.fileHint': '仅支持 TXT，最大 500KB',
        'control.speed': '语速',
        'control.pitch': '音调',
        'control.style': '风格',
        'control.speedMin': '慢',
        'control.speedMax': '快',
        'control.pitchMin': '低',
        'control.pitchMax': '高',
        'style.general': '通用',
        'style.assistant': '助手',
        'style.chat': '对话',
        'style.customerservice': '客服',
        'style.newscast': '新闻播报',
        'style.affectionate': '亲切',
        'style.calm': '平静',
        'style.cheerful': '愉快',
        'style.gentle': '温和',
        'style.lyrical': '抒情',
        'style.serious': '严肃',
        'voice.title': '声音库',
        'voice.subtitle': '按名称、地区、性别或 ID 搜索 114 个 Edge 声音。',
        'voice.search': '搜索声音',
        'voice.searchPlaceholder': '晓晓、Jenny、zh-CN、en-US...',
        'voice.empty': '没有匹配的声音。',
        'voice.selected': '已选择',
        'stt.title': '语音转文字',
        'stt.subtitle': '上传音频，使用现有 API 流程转录。',
        'stt.upload': '上传音频文件',
        'stt.fileDrop': '拖拽音频文件到此处，或点击选择',
        'stt.fileHint': '支持 mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp，最大 10MB',
        'stt.result': '转录结果',
        'stt.resultPlaceholder': '转录结果将在这里显示...',
        'token.title': 'API Token',
        'token.default': '使用默认 Token',
        'token.custom': '使用硅基流动自定义 Token',
        'token.placeholder': '输入 API Token',
        'action.generate': '生成语音',
        'action.transcribe': '开始转录',
        'action.copy': '复制文本',
        'action.edit': '编辑文本',
        'action.save': '保存编辑',
        'action.copied': '已复制',
        'action.useForTts': '转为语音',
        'status.generating': '正在生成...',
        'status.longText': '正在处理长文本...',
        'status.file': '正在处理上传文件...',
        'status.ssml': '正在处理 SSML...',
        'status.transcribing': '正在转录...'
      },
      ja: { 'page.title': 'VoiceCraft - AI音声ワークスペース', 'page.description': 'VoiceCraft AI音声ワークスペース with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': '日本語', 'header.subtitle': 'AI音声ワークスペース', 'mode.tts': 'テキスト読み上げ', 'mode.transcription': '音声テキスト変換', 'tts.title': 'テキスト読み上げ', 'tts.subtitle': 'テキストを入力またはアップロードし、音声と設定を選んでMP3を生成します。', 'input.method': '入力方法', 'input.manual': '手動入力', 'input.upload': 'txtをアップロード', 'input.ssml': 'SSML', 'input.ssmlText': 'SSML入力', 'input.ssmlPlaceholder': '完全なSSMLをここに貼り付け...', 'input.ssmlHint': '完全なSSMLを貼り付けます。SSMLモードでは音声、速度、ピッチ、スタイル設定は無視されます。', 'input.text': '入力テキスト', 'input.textPlaceholder': '音声に変換するテキストを入力してください...', 'input.file': 'txtファイルをアップロード', 'input.fileDrop': 'txtファイルをここにドロップ、またはクリックして選択', 'input.fileHint': 'TXTのみ、最大500KB', 'control.speed': '速度', 'control.pitch': 'ピッチ', 'control.style': 'スタイル', 'control.speedMin': '遅い', 'control.speedMax': '速い', 'control.pitchMin': '低い', 'control.pitchMax': '高い', 'style.general': '標準', 'style.assistant': 'アシスタント', 'style.chat': 'チャット', 'style.customerservice': 'カスタマーサービス', 'style.newscast': 'ニュース', 'style.affectionate': '親しみ', 'style.calm': '落ち着き', 'style.cheerful': '明るい', 'style.gentle': 'やさしい', 'style.lyrical': '叙情的', 'style.serious': 'まじめ', 'voice.title': '音声ライブラリ', 'voice.subtitle': '名前、ロケール、性別、IDで114個のEdge音声を検索します。', 'voice.search': '音声を検索', 'voice.searchPlaceholder': 'Xiaoxiao、Jenny、zh-CN、en-US...', 'voice.empty': '一致する音声がありません。', 'voice.selected': '選択中', 'stt.title': '音声テキスト変換', 'stt.subtitle': '音声をアップロードし、既存のAPIフローで文字起こしします。', 'stt.upload': '音声ファイルをアップロード', 'stt.fileDrop': '音声ファイルをここにドロップ、またはクリックして選択', 'stt.fileHint': 'mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp、最大10MB', 'stt.result': '文字起こし結果', 'stt.resultPlaceholder': '文字起こし結果がここに表示されます...', 'token.title': 'API Token', 'token.default': '既定のTokenを使用', 'token.custom': 'カスタムSiliconFlow Tokenを使用', 'token.placeholder': 'API Tokenを入力', 'action.generate': '音声を生成', 'action.transcribe': '文字起こしを開始', 'action.copy': 'テキストをコピー', 'action.edit': '編集', 'action.save': '編集を保存', 'action.copied': 'コピーしました', 'action.useForTts': 'TTSで使う', 'status.generating': '生成中...', 'status.longText': '長いテキストを処理中...', 'status.file': 'アップロードファイルを処理中...', 'status.ssml': 'SSMLを処理中...', 'status.transcribing': '文字起こし中...' }, ko: { 'page.title': 'VoiceCraft - AI 음성 작업 공간', 'page.description': 'VoiceCraft AI 음성 작업 공간 with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': '한국어', 'header.subtitle': 'AI 음성 작업 공간', 'mode.tts': '텍스트 음성 변환', 'mode.transcription': '음성 텍스트 변환', 'tts.title': '텍스트 음성 변환', 'tts.subtitle': '텍스트를 입력하거나 업로드하고 음성과 설정을 선택해 MP3를 생성합니다.', 'input.method': '입력 방식', 'input.manual': '직접 입력', 'input.upload': 'txt 업로드', 'input.ssml': 'SSML', 'input.ssmlText': 'SSML 입력', 'input.ssmlPlaceholder': '완전한 SSML을 여기에 붙여넣기...', 'input.ssmlHint': '완전한 SSML을 붙여넣습니다. SSML 모드에서는 음성, 속도, 피치, 스타일 컨트롤이 무시됩니다.', 'input.text': '입력 텍스트', 'input.textPlaceholder': '음성으로 변환할 텍스트를 입력하세요...', 'input.file': 'txt 파일 업로드', 'input.fileDrop': 'txt 파일을 여기에 놓거나 클릭해 선택', 'input.fileHint': 'TXT만 지원, 최대 500KB', 'control.speed': '속도', 'control.pitch': '피치', 'control.style': '스타일', 'control.speedMin': '느림', 'control.speedMax': '빠름', 'control.pitchMin': '낮음', 'control.pitchMax': '높음', 'style.general': '일반', 'style.assistant': '어시스턴트', 'style.chat': '대화', 'style.customerservice': '고객 서비스', 'style.newscast': '뉴스', 'style.affectionate': '친근함', 'style.calm': '차분함', 'style.cheerful': '명랑함', 'style.gentle': '부드러움', 'style.lyrical': '서정적', 'style.serious': '진지함', 'voice.title': '음성 라이브러리', 'voice.subtitle': '이름, 로캘, 성별 또는 ID로 114개 Edge 음성을 검색합니다.', 'voice.search': '음성 검색', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': '일치하는 음성이 없습니다.', 'voice.selected': '선택됨', 'stt.title': '음성 텍스트 변환', 'stt.subtitle': '오디오를 업로드하고 기존 API 흐름으로 전사합니다.', 'stt.upload': '오디오 파일 업로드', 'stt.fileDrop': '오디오 파일을 여기에 놓거나 클릭해 선택', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. 최대 10MB', 'stt.result': '전사 결과', 'stt.resultPlaceholder': '전사 결과가 여기에 표시됩니다...', 'token.title': 'API Token', 'token.default': '기본 Token 사용', 'token.custom': '사용자 SiliconFlow Token 사용', 'token.placeholder': 'API Token 입력', 'action.generate': '음성 생성', 'action.transcribe': '전사 시작', 'action.copy': '텍스트 복사', 'action.edit': '편집', 'action.save': '편집 저장', 'action.copied': '복사됨', 'action.useForTts': 'TTS에 사용', 'status.generating': '생성 중...', 'status.longText': '긴 텍스트 처리 중...', 'status.file': '업로드 파일 처리 중...', 'status.ssml': 'SSML 처리 중...', 'status.transcribing': '전사 중...' }, es: { 'page.title': 'VoiceCraft - Espacio de trabajo de voz con IA', 'page.description': 'VoiceCraft Espacio de trabajo de voz con IA with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Español', 'header.subtitle': 'Espacio de trabajo de voz con IA', 'mode.tts': 'Texto a voz', 'mode.transcription': 'Voz a texto', 'tts.title': 'Texto a voz', 'tts.subtitle': 'Escribe o sube texto, ajusta la voz y genera un MP3.', 'input.method': 'Método de entrada', 'input.manual': 'Texto manual', 'input.upload': 'Subir txt', 'input.ssml': 'SSML', 'input.ssmlText': 'Entrada SSML', 'input.ssmlPlaceholder': 'Pega SSML completo aquí...', 'input.ssmlHint': 'Pega SSML completo. Los controles de voz, velocidad, tono y estilo se ignoran en modo SSML.', 'input.text': 'Texto de entrada', 'input.textPlaceholder': 'Introduce el texto para convertirlo en voz...', 'input.file': 'Subir archivo txt', 'input.fileDrop': 'Suelta un txt aquí o haz clic para elegir', 'input.fileHint': 'Solo TXT, máximo 500KB', 'control.speed': 'Velocidad', 'control.pitch': 'Tono', 'control.style': 'Estilo', 'control.speedMin': 'Lento', 'control.speedMax': 'Rápido', 'control.pitchMin': 'Bajo', 'control.pitchMax': 'Alto', 'style.general': 'General', 'style.assistant': 'Asistente', 'style.chat': 'Chat', 'style.customerservice': 'Atención al cliente', 'style.newscast': 'Noticias', 'style.affectionate': 'Afectuoso', 'style.calm': 'Calmo', 'style.cheerful': 'Alegre', 'style.gentle': 'Suave', 'style.lyrical': 'Lírico', 'style.serious': 'Serio', 'voice.title': 'Biblioteca de voces', 'voice.subtitle': 'Busca 114 voces Edge por nombre, región, género o ID.', 'voice.search': 'Buscar voces', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'No hay voces coincidentes.', 'voice.selected': 'Seleccionado', 'stt.title': 'Voz a texto', 'stt.subtitle': 'Sube audio y transcríbelo con el flujo API existente.', 'stt.upload': 'Subir audio', 'stt.fileDrop': 'Suelta un audio aquí o haz clic para elegir', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Máximo 10MB', 'stt.result': 'Resultado de transcripción', 'stt.resultPlaceholder': 'El resultado aparecerá aquí...', 'token.title': 'API Token', 'token.default': 'Usar Token predeterminado', 'token.custom': 'Usar Token personalizado de SiliconFlow', 'token.placeholder': 'Introduce API Token', 'action.generate': 'Generar voz', 'action.transcribe': 'Transcribir audio', 'action.copy': 'Copiar texto', 'action.edit': 'Editar texto', 'action.save': 'Guardar edición', 'action.copied': 'Copiado', 'action.useForTts': 'Usar para TTS', 'status.generating': 'Generando...', 'status.longText': 'Procesando texto largo...', 'status.file': 'Procesando archivo subido...', 'status.ssml': 'Procesando SSML...', 'status.transcribing': 'Transcribiendo...' }, fr: { 'page.title': 'VoiceCraft - Espace de travail vocal IA', 'page.description': 'VoiceCraft Espace de travail vocal IA with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Français', 'header.subtitle': 'Espace de travail vocal IA', 'mode.tts': 'Texte vers parole', 'mode.transcription': 'Parole vers texte', 'tts.title': 'Texte vers parole', 'tts.subtitle': 'Saisissez ou importez du texte, réglez la voix, puis générez un MP3.', 'input.method': 'Méthode de saisie', 'input.manual': 'Texte manuel', 'input.upload': 'Importer txt', 'input.ssml': 'SSML', 'input.ssmlText': 'Saisie SSML', 'input.ssmlPlaceholder': 'Collez le SSML complet ici...', 'input.ssmlHint': 'Collez un SSML complet. Les contrôles de voix, vitesse, hauteur et style sont ignorés en mode SSML.', 'input.text': 'Texte à saisir', 'input.textPlaceholder': 'Saisissez le texte à convertir en parole...', 'input.file': 'Importer un fichier txt', 'input.fileDrop': 'Déposez un txt ici ou cliquez pour choisir', 'input.fileHint': 'TXT uniquement, 500KB max', 'control.speed': 'Vitesse', 'control.pitch': 'Hauteur', 'control.style': 'Style', 'control.speedMin': 'Lent', 'control.speedMax': 'Rapide', 'control.pitchMin': 'Bas', 'control.pitchMax': 'Haut', 'style.general': 'Général', 'style.assistant': 'Assistant', 'style.chat': 'Conversation', 'style.customerservice': 'Service client', 'style.newscast': 'Journal', 'style.affectionate': 'Affectueux', 'style.calm': 'Calme', 'style.cheerful': 'Enjoué', 'style.gentle': 'Doux', 'style.lyrical': 'Lyrique', 'style.serious': 'Sérieux', 'voice.title': 'Bibliothèque de voix', 'voice.subtitle': 'Recherchez 114 voix Edge par nom, région, genre ou ID.', 'voice.search': 'Rechercher des voix', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Aucune voix correspondante.', 'voice.selected': 'Sélectionné', 'stt.title': 'Parole vers texte', 'stt.subtitle': 'Importez un audio et transcrivez-le avec le flux API existant.', 'stt.upload': 'Importer un audio', 'stt.fileDrop': 'Déposez un audio ici ou cliquez pour choisir', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. 10MB max', 'stt.result': 'Résultat de transcription', 'stt.resultPlaceholder': 'Le résultat apparaîtra ici...', 'token.title': 'API Token', 'token.default': 'Utiliser le Token par défaut', 'token.custom': 'Utiliser un Token SiliconFlow personnalisé', 'token.placeholder': 'Saisir API Token', 'action.generate': 'Générer la voix', 'action.transcribe': 'Transcrire audio', 'action.copy': 'Copier le texte', 'action.edit': 'Modifier', 'action.save': 'Enregistrer', 'action.copied': 'Copié', 'action.useForTts': 'Utiliser pour TTS', 'status.generating': 'Génération...', 'status.longText': 'Traitement du texte long...', 'status.file': 'Traitement du fichier importé...', 'status.ssml': 'Traitement SSML...', 'status.transcribing': 'Transcription...' }, de: { 'page.title': 'VoiceCraft - KI-Sprach-Arbeitsbereich', 'page.description': 'VoiceCraft KI-Sprach-Arbeitsbereich with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Deutsch', 'header.subtitle': 'KI-Sprach-Arbeitsbereich', 'mode.tts': 'Text zu Sprache', 'mode.transcription': 'Sprache zu Text', 'tts.title': 'Text zu Sprache', 'tts.subtitle': 'Text eingeben oder hochladen, Stimme einstellen und MP3 erzeugen.', 'input.method': 'Eingabemethode', 'input.manual': 'Manueller Text', 'input.upload': 'txt hochladen', 'input.ssml': 'SSML', 'input.ssmlText': 'SSML-Eingabe', 'input.ssmlPlaceholder': 'Vollständiges SSML hier einfügen...', 'input.ssmlHint': 'Vollständiges SSML einfügen. Stimme, Geschwindigkeit, Tonhöhe und Stil werden im SSML-Modus ignoriert.', 'input.text': 'Eingabetext', 'input.textPlaceholder': 'Text zur Sprachsynthese eingeben...', 'input.file': 'txt-Datei hochladen', 'input.fileDrop': 'txt hier ablegen oder klicken', 'input.fileHint': 'Nur TXT, max. 500KB', 'control.speed': 'Geschwindigkeit', 'control.pitch': 'Tonhöhe', 'control.style': 'Stil', 'control.speedMin': 'Langsam', 'control.speedMax': 'Schnell', 'control.pitchMin': 'Tief', 'control.pitchMax': 'Hoch', 'style.general': 'Allgemein', 'style.assistant': 'Assistent', 'style.chat': 'Chat', 'style.customerservice': 'Kundendienst', 'style.newscast': 'Nachrichten', 'style.affectionate': 'Herzlich', 'style.calm': 'Ruhig', 'style.cheerful': 'Fröhlich', 'style.gentle': 'Sanft', 'style.lyrical': 'Lyrisch', 'style.serious': 'Ernst', 'voice.title': 'Stimmenbibliothek', 'voice.subtitle': '114 Edge-Stimmen nach Name, Region, Geschlecht oder ID suchen.', 'voice.search': 'Stimmen suchen', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Keine passenden Stimmen.', 'voice.selected': 'Ausgewählt', 'stt.title': 'Sprache zu Text', 'stt.subtitle': 'Audio hochladen und mit dem bestehenden API-Ablauf transkribieren.', 'stt.upload': 'Audiodatei hochladen', 'stt.fileDrop': 'Audio hier ablegen oder klicken', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. Max. 10MB', 'stt.result': 'Transkriptionsergebnis', 'stt.resultPlaceholder': 'Das Ergebnis erscheint hier...', 'token.title': 'API Token', 'token.default': 'Standard-Token verwenden', 'token.custom': 'Eigenes SiliconFlow-Token verwenden', 'token.placeholder': 'API Token eingeben', 'action.generate': 'Stimme erzeugen', 'action.transcribe': 'Audio transkribieren', 'action.copy': 'Text kopieren', 'action.edit': 'Bearbeiten', 'action.save': 'Speichern', 'action.copied': 'Kopiert', 'action.useForTts': 'Für TTS verwenden', 'status.generating': 'Erzeuge...', 'status.longText': 'Langer Text wird verarbeitet...', 'status.file': 'Hochgeladene Datei wird verarbeitet...', 'status.ssml': 'SSML wird verarbeitet...', 'status.transcribing': 'Transkribiere...' }, ru: { 'page.title': 'VoiceCraft - AI рабочая область голоса', 'page.description': 'VoiceCraft AI рабочая область голоса with 114 voices.', 'page.keywords': 'text to speech,AI voice,TTS,STT', 'header.title': 'VoiceCraft', 'lang.current': 'Русский', 'header.subtitle': 'AI рабочая область голоса', 'mode.tts': 'Текст в речь', 'mode.transcription': 'Речь в текст', 'tts.title': 'Текст в речь', 'tts.subtitle': 'Введите или загрузите текст, настройте голос и создайте MP3.', 'input.method': 'Способ ввода', 'input.manual': 'Ввести текст', 'input.upload': 'Загрузить txt', 'input.ssml': 'SSML', 'input.ssmlText': 'Ввод SSML', 'input.ssmlPlaceholder': 'Вставьте полный SSML здесь...', 'input.ssmlHint': 'Вставьте полный SSML. В режиме SSML настройки голоса, скорости, тона и стиля игнорируются.', 'input.text': 'Текст', 'input.textPlaceholder': 'Введите текст для озвучивания...', 'input.file': 'Загрузить txt файл', 'input.fileDrop': 'Перетащите txt сюда или нажмите для выбора', 'input.fileHint': 'Только TXT, до 500KB', 'control.speed': 'Скорость', 'control.pitch': 'Тон', 'control.style': 'Стиль', 'control.speedMin': 'Медленно', 'control.speedMax': 'Быстро', 'control.pitchMin': 'Низко', 'control.pitchMax': 'Высоко', 'style.general': 'Обычный', 'style.assistant': 'Ассистент', 'style.chat': 'Диалог', 'style.customerservice': 'Поддержка', 'style.newscast': 'Новости', 'style.affectionate': 'Теплый', 'style.calm': 'Спокойный', 'style.cheerful': 'Веселый', 'style.gentle': 'Мягкий', 'style.lyrical': 'Лиричный', 'style.serious': 'Серьезный', 'voice.title': 'Библиотека голосов', 'voice.subtitle': 'Поиск 114 голосов Edge по имени, региону, полу или ID.', 'voice.search': 'Поиск голосов', 'voice.searchPlaceholder': 'Xiaoxiao, Jenny, zh-CN, en-US...', 'voice.empty': 'Подходящих голосов нет.', 'voice.selected': 'Выбрано', 'stt.title': 'Речь в текст', 'stt.subtitle': 'Загрузите аудио и расшифруйте через текущий API.', 'stt.upload': 'Загрузить аудио', 'stt.fileDrop': 'Перетащите аудио сюда или нажмите для выбора', 'stt.fileHint': 'mp3, wav, m4a, flac, aac, ogg, webm, amr, 3gp. До 10MB', 'stt.result': 'Результат распознавания', 'stt.resultPlaceholder': 'Результат появится здесь...', 'token.title': 'API Token', 'token.default': 'Использовать Token по умолчанию', 'token.custom': 'Использовать свой SiliconFlow Token', 'token.placeholder': 'Введите API Token', 'action.generate': 'Создать голос', 'action.transcribe': 'Распознать аудио', 'action.copy': 'Копировать текст', 'action.edit': 'Редактировать', 'action.save': 'Сохранить', 'action.copied': 'Скопировано', 'action.useForTts': 'Использовать для TTS', 'status.generating': 'Создание...', 'status.longText': 'Обработка длинного текста...', 'status.file': 'Обработка загруженного файла...', 'status.ssml': 'Обработка SSML...', 'status.transcribing': 'Распознавание...' }
    };

    const SSML_EXAMPLE_TRANSLATIONS = {
      ja: { 'input.useSsmlExample': 'サンプルを入力' },
      ko: { 'input.useSsmlExample': '예시 채우기' },
      es: { 'input.useSsmlExample': 'Rellenar ejemplo' },
      fr: { 'input.useSsmlExample': 'Remplir l’exemple' },
      de: { 'input.useSsmlExample': 'Beispiel einfügen' },
      ru: { 'input.useSsmlExample': 'Вставить пример' }
    };
    Object.keys(SSML_EXAMPLE_TRANSLATIONS).forEach(function(lang) { Object.assign(translations[lang], SSML_EXAMPLE_TRANSLATIONS[lang]); });
    const languageNames = { en:'English', zh:'中文', ja:'日本語', ko:'한국어', es:'Español', fr:'Français', de:'Deutsch', ru:'Русский' };
    document.addEventListener('DOMContentLoaded', function() { initializeTheme(); initializeI18n(); initializeInputMethodTabs(); initializeFileUpload(); initializeModeSwitcher(); initializeAudioUpload(); initializeTokenConfig(); initializeLanguageSwitcher(); initializeVoicePicker(); initializeTextCounter(); initializeRangeControls(); initializeSsmlExample(); });
    function applyTheme(theme) { document.documentElement.setAttribute('data-theme', theme); }
    function initializeTheme() { const themeBtn = document.getElementById('themeBtn'); if (themeBtn) themeBtn.addEventListener('click', function() { const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('voicecraft-theme', next); applyTheme(next); }); if (window.matchMedia) { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(event) { if (!localStorage.getItem('voicecraft-theme')) applyTheme(event.matches ? 'dark' : 'light'); }); } }
    function detectLanguage() { const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase(); if (browserLang.startsWith('zh')) return 'zh'; if (browserLang.startsWith('ja')) return 'ja'; if (browserLang.startsWith('ko')) return 'ko'; if (browserLang.startsWith('es')) return 'es'; if (browserLang.startsWith('fr')) return 'fr'; if (browserLang.startsWith('de')) return 'de'; if (browserLang.startsWith('ru')) return 'ru'; return 'en'; }
    function setLanguage(lang) { currentLanguage = translations[lang] ? lang : 'en'; localStorage.setItem('voicecraft-language', currentLanguage); applyTranslations(); updateLanguageSwitcher(); updateTextCounter(); }
    function t(key) { const dict = translations[currentLanguage] || translations.en; return dict[key] || translations.en[key] || key; }
    function applyTranslations() { document.querySelectorAll('[data-i18n]').forEach(function(element) { element.textContent = t(element.getAttribute('data-i18n')); }); document.querySelectorAll('[data-i18n-content]').forEach(function(element) { element.setAttribute('content', t(element.getAttribute('data-i18n-content'))); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(function(element) { element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder'))); }); document.title = t('page.title'); if (document.getElementById('voiceList')) renderVoiceList(); }
    function updateLanguageSwitcher() { document.getElementById('currentLangName').textContent = languageNames[currentLanguage] || 'English'; document.querySelectorAll('.language-option').forEach(function(option) { option.classList.toggle('active', option.dataset.lang === currentLanguage); }); }
    function initializeI18n() { setLanguage(localStorage.getItem('voicecraft-language') || detectLanguage()); }
    function initializeLanguageSwitcher() { const languageBtn = document.getElementById('languageBtn'); const languageDropdown = document.getElementById('languageDropdown'); languageBtn.addEventListener('click', function(event) { event.stopPropagation(); const open = languageDropdown.classList.toggle('show'); languageBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }); document.addEventListener('click', function() { languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); document.querySelectorAll('.language-option').forEach(function(option) { option.addEventListener('click', function(event) { event.stopPropagation(); setLanguage(option.dataset.lang); languageDropdown.classList.remove('show'); languageBtn.setAttribute('aria-expanded', 'false'); }); }); }
    function getSelectedVoiceId() { return selectedVoiceId; }
    function getVoiceById(voiceId) { return VOICES.find(function(voice) { return voice.id === voiceId; }) || VOICES[0]; }
    function getUniqueVoiceValues(key) { return ['All'].concat(Array.from(new Set(VOICES.map(function(voice) { return voice[key]; }))).sort()); }
    function filterVoices() { const query = document.getElementById('voiceSearch').value.trim().toLowerCase(); return VOICES.filter(function(voice) { const matchesLanguage = activeLanguageFilter === 'All' || voice.language === activeLanguageFilter; const matchesGender = activeGenderFilter === 'All' || voice.gender === activeGenderFilter; const searchText = [voice.id, voice.name, voice.locale, voice.language, voice.gender, voice.description].join(' ').toLowerCase(); return matchesLanguage && matchesGender && (!query || searchText.includes(query)); }); }
    function renderFilterGroup(containerId, values, activeValue, onSelect) { const container = document.getElementById(containerId); container.innerHTML = values.map(function(value) { const active = value === activeValue ? ' active' : ''; return '<button type="button" class="filter-chip' + active + '" data-value="' + value + '">' + value + '</button>'; }).join(''); container.querySelectorAll('.filter-chip').forEach(function(button) { button.addEventListener('click', function() { onSelect(button.dataset.value); }); }); }
    function renderVoiceList() { const voices = filterVoices(); const list = document.getElementById('voiceList'); const emptyState = document.getElementById('voiceEmptyState'); const selectedVoice = getVoiceById(selectedVoiceId); updateSelectedVoiceSummary(); document.getElementById('voiceCount').textContent = voices.length + ' of ' + VOICES.length + ' voices'; emptyState.style.display = voices.length ? 'none' : 'block'; list.innerHTML = voices.map(function(voice) { const active = voice.id === selectedVoice.id ? ' active' : ''; const description = voice.description ? ' · ' + voice.description : ''; return '<button type="button" class="voice-item' + active + '" data-voice-id="' + voice.id + '" role="option" tabindex="' + (voice.id === selectedVoice.id ? '0' : '-1') + '" aria-selected="' + (voice.id === selectedVoice.id) + '"><span class="voice-name">' + voice.name + '</span><span class="voice-meta">' + voice.locale + ' · ' + voice.gender + description + '</span><span class="voice-id">' + voice.id + '</span></button>'; }).join(''); }
    function updateSelectedVoiceSummary() { const v = getVoiceById(selectedVoiceId); document.getElementById('selectedVoiceId').value = v.id; document.getElementById('selectedVoiceSummary').textContent = t('voice.selected') + ': ' + v.name + ' · ' + v.id; }
    function selectVoice(voiceId) { selectedVoiceId = voiceId; const list = document.getElementById('voiceList'); list.querySelectorAll('.voice-item').forEach(function(item) { const active = item.dataset.voiceId === voiceId; item.classList.toggle('active', active); item.setAttribute('aria-selected', active); item.setAttribute('tabindex', active ? '0' : '-1'); }); updateSelectedVoiceSummary(); }
    function handleLanguageFilterSelect(value) { activeLanguageFilter = value; renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderVoiceList(); }
    function handleGenderFilterSelect(value) { activeGenderFilter = value; renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); renderVoiceList(); }
    function initializeVoicePicker() { renderFilterGroup('voiceLanguageFilters', getUniqueVoiceValues('language'), activeLanguageFilter, handleLanguageFilterSelect); renderFilterGroup('voiceGenderFilters', getUniqueVoiceValues('gender'), activeGenderFilter, handleGenderFilterSelect); document.getElementById('voiceSearch').addEventListener('input', function() { clearTimeout(voiceSearchTimer); voiceSearchTimer = setTimeout(renderVoiceList, CONFIG.SEARCH_DEBOUNCE); }); initializeVoiceKeyboard(); document.getElementById('voiceList').addEventListener('click', function(event) { const item = event.target.closest('.voice-item'); if (item) selectVoice(item.dataset.voiceId); }); renderVoiceList(); }
    function initializeVoiceKeyboard() { const list = document.getElementById('voiceList'); list.addEventListener('keydown', function(event) { const items = Array.from(list.querySelectorAll('.voice-item')); if (!items.length) return; const currentIndex = Math.max(0, items.findIndex(function(item) { return item.dataset.voiceId === selectedVoiceId; })); let nextIndex = currentIndex; if (event.key === 'ArrowDown') nextIndex = Math.min(items.length - 1, currentIndex + 1); else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1); else if (event.key === 'Home') nextIndex = 0; else if (event.key === 'End') nextIndex = items.length - 1; else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectVoice(items[currentIndex].dataset.voiceId); return; } else return; event.preventDefault(); selectVoice(items[nextIndex].dataset.voiceId); items[nextIndex].focus(); }); }
    function updateTextCounter() { const textInput = document.getElementById('text'); const counter = document.getElementById('textCounter'); if (!textInput || !counter) return; const length = textInput.value.length; counter.textContent = length ? length + ' / ' + CONFIG.MAX_TEXT_LENGTH : ''; counter.classList.toggle('warning', length > CONFIG.MAX_TEXT_LENGTH); }
    function initializeTextCounter() { const textInput = document.getElementById('text'); if (!textInput) return; textInput.addEventListener('input', updateTextCounter); updateTextCounter(); }
    function formatSpeedValue(value) { return Number(value).toFixed(2) + 'x'; }
    function formatPitchValue(value) { const number = Number(value); return (number >= 0 ? '+' : '') + number; }
    function updateRangeValues() { const speed = document.getElementById('speed'); const pitch = document.getElementById('pitch'); const speedValue = document.getElementById('speedValue'); const pitchValue = document.getElementById('pitchValue'); if (speed && speedValue) speedValue.textContent = formatSpeedValue(speed.value); if (pitch && pitchValue) pitchValue.textContent = formatPitchValue(pitch.value); }
    function resetRangeControl(id) { const input = document.getElementById(id); if (!input) return; input.value = id === 'speed' ? '1' : '0'; updateRangeValues(); }
    function initializeRangeControls() { ['speed', 'pitch'].forEach(function(id) { const input = document.getElementById(id); if (input) { input.addEventListener('input', updateRangeValues); input.addEventListener('dblclick', function() { resetRangeControl(id); }); } }); updateRangeValues(); }
    function initializeSsmlExample() { const code = document.getElementById('ssmlExampleCode'); const shell = document.getElementById('ssmlTextareaShell'); const ssmlInput = document.getElementById('ssml'); const button = document.getElementById('useSsmlExampleBtn'); if (!code || !shell || !ssmlInput) return; code.textContent = SSML_EXAMPLE; function syncGhostExample() { shell.classList.toggle('has-value', Boolean(ssmlInput.value.trim())); } ssmlInput.addEventListener('input', syncGhostExample); if (button) button.addEventListener('click', function() { ssmlInput.value = SSML_EXAMPLE; ssmlInput.dispatchEvent(new Event('input', { bubbles: true })); ssmlInput.focus(); }); syncGhostExample(); }
    function showToast(message) { if (!message) return; window.alert(message); }
    function initializeInputMethodTabs() { const textInputTab = document.getElementById('textInputTab'); const fileUploadTab = document.getElementById('fileUploadTab'); const ssmlInputTab = document.getElementById('ssmlInputTab'); const textInputArea = document.getElementById('textInputArea'); const fileUploadArea = document.getElementById('fileUploadArea'); const ssmlInputArea = document.getElementById('ssmlInputArea'); const textInput = document.getElementById('text'); const ssmlInput = document.getElementById('ssml'); function setInputMethod(method) { currentInputMethod = method; textInputTab.classList.toggle('active', method === 'text'); fileUploadTab.classList.toggle('active', method === 'file'); ssmlInputTab.classList.toggle('active', method === 'ssml'); textInputArea.style.display = method === 'text' ? 'block' : 'none'; fileUploadArea.style.display = method === 'file' ? 'block' : 'none'; ssmlInputArea.style.display = method === 'ssml' ? 'block' : 'none'; textInput.required = method === 'text'; ssmlInput.required = method === 'ssml'; } textInputTab.addEventListener('click', function() { setInputMethod('text'); }); fileUploadTab.addEventListener('click', function() { setInputMethod('file'); }); ssmlInputTab.addEventListener('click', function() { setInputMethod('ssml'); }); setInputMethod('text'); }
    function initializeFileUpload() { const fileDropZone = document.getElementById('fileDropZone'); const fileInput = document.getElementById('fileInput'); const fileRemoveBtn = document.getElementById('fileRemoveBtn'); fileDropZone.addEventListener('click', function() { fileInput.click(); }); fileDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput.click(); } }); fileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleFileSelect(event.target.files[0]); }); fileDropZone.addEventListener('dragover', function(event) { event.preventDefault(); fileDropZone.classList.add('dragover'); }); fileDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); }); fileDropZone.addEventListener('drop', function(event) { event.preventDefault(); fileDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleFileSelect(event.dataTransfer.files[0]); }); fileRemoveBtn.addEventListener('click', function() { selectedFile = null; fileInput.value = ''; document.getElementById('fileInfo').style.display = 'none'; fileDropZone.style.display = 'block'; }); }
    function handleFileSelect(file) { if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) { alert('请选择txt格式的文本文件'); return; } if (file.size > 500 * 1024) { alert('文件大小不能超过500KB'); return; } selectedFile = file; document.getElementById('fileName').textContent = file.name; document.getElementById('fileSize').textContent = formatFileSize(file.size); document.getElementById('fileInfo').style.display = 'flex'; document.getElementById('fileDropZone').style.display = 'none'; }
    function formatFileSize(bytes) { if (bytes === 0) return '0 Bytes'; const k = 1024; const sizes = ['Bytes', 'KB', 'MB']; const i = Math.floor(Math.log(bytes) / Math.log(k)); return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]; }
    document.getElementById('ttsForm').addEventListener('submit', async function(event) { event.preventDefault(); const voice = getSelectedVoiceId(); const speed = document.getElementById('speed').value; const pitch = document.getElementById('pitch').value; const style = document.getElementById('style').value; const generateBtn = document.getElementById('generateBtn'); const resultContainer = document.getElementById('result'); const loading = document.getElementById('loading'); const success = document.getElementById('success'); const error = document.getElementById('error'); if (currentInputMethod === 'text' && !document.getElementById('text').value.trim()) { alert('请输入要转换的文本内容'); return; } if (currentInputMethod === 'file' && !selectedFile) { alert('请选择要上传的txt文件'); return; } if (currentInputMethod === 'ssml' && !document.getElementById('ssml').value.trim()) { alert('请输入SSML内容'); return; } resultContainer.style.display = 'block'; loading.style.display = 'block'; success.style.display = 'none'; error.style.display = 'none'; generateBtn.disabled = true; generateBtn.textContent = t('status.generating'); try { let response; const loadingText = document.getElementById('loadingText'); const progressInfo = document.getElementById('progressInfo'); if (currentInputMethod === 'text') { const text = document.getElementById('text').value; loadingText.textContent = text.length > 3000 ? t('status.longText') : t('status.generating'); progressInfo.textContent = 'Text length: ' + text.length + ' characters'; response = await fetch('/v1/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text, voice: voice, speed: parseFloat(speed), pitch: pitch, style: style }) }); } else if (currentInputMethod === 'ssml') { const ssml = document.getElementById('ssml').value; loadingText.textContent = t('status.ssml'); progressInfo.textContent = 'SSML length: ' + ssml.length + ' characters'; response = await fetch('/v1/audio/speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: ssml, inputType: 'ssml' }) }); } else { loadingText.textContent = t('status.file'); progressInfo.textContent = 'File: ' + selectedFile.name + ' (' + formatFileSize(selectedFile.size) + ')'; const formData = new FormData(); formData.append('file', selectedFile); formData.append('voice', voice); formData.append('speed', speed); formData.append('pitch', pitch); formData.append('style', style); response = await fetch('/v1/audio/speech', { method: 'POST', body: formData }); } if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '生成失败'); } const audioBlob = await response.blob(); const audioUrl = URL.createObjectURL(audioBlob); document.getElementById('audioPlayer').src = audioUrl; document.getElementById('downloadBtn').href = audioUrl; loading.style.display = 'none'; success.style.display = 'block'; } catch (err) { loading.style.display = 'none'; error.style.display = 'block'; error.textContent = '错误: ' + err.message; } finally { generateBtn.disabled = false; generateBtn.textContent = t('action.generate'); } });
    function initializeModeSwitcher() { document.getElementById('ttsMode').addEventListener('click', function() { switchMode('tts'); }); document.getElementById('transcriptionMode').addEventListener('click', function() { switchMode('transcription'); }); }
    function switchMode(mode) { const ttsMode = document.getElementById('ttsMode'); const transcriptionMode = document.getElementById('transcriptionMode'); const ttsWorkspace = document.getElementById('ttsWorkspace'); const transcriptionContainer = document.getElementById('transcriptionContainer'); currentMode = mode; if (mode === 'tts') { ttsMode.classList.add('active'); transcriptionMode.classList.remove('active'); ttsMode.setAttribute('aria-selected', 'true'); transcriptionMode.setAttribute('aria-selected', 'false'); ttsWorkspace.style.display = 'grid'; transcriptionContainer.style.display = 'none'; } else { transcriptionMode.classList.add('active'); ttsMode.classList.remove('active'); transcriptionMode.setAttribute('aria-selected', 'true'); ttsMode.setAttribute('aria-selected', 'false'); ttsWorkspace.style.display = 'none'; transcriptionContainer.style.display = 'block'; } }
    function initializeAudioUpload() { const audioDropZone = document.getElementById('audioDropZone'); const audioFileInput = document.getElementById('audioFileInput'); const audioFileRemoveBtn = document.getElementById('audioFileRemoveBtn'); audioDropZone.addEventListener('click', function() { audioFileInput.click(); }); audioDropZone.addEventListener('keydown', function(event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); audioFileInput.click(); } }); audioFileInput.addEventListener('change', function(event) { if (event.target.files[0]) handleAudioFileSelect(event.target.files[0]); }); audioDropZone.addEventListener('dragover', function(event) { event.preventDefault(); audioDropZone.classList.add('dragover'); }); audioDropZone.addEventListener('dragleave', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); }); audioDropZone.addEventListener('drop', function(event) { event.preventDefault(); audioDropZone.classList.remove('dragover'); if (event.dataTransfer.files[0]) handleAudioFileSelect(event.dataTransfer.files[0]); }); audioFileRemoveBtn.addEventListener('click', function() { selectedAudioFile = null; audioFileInput.value = ''; document.getElementById('audioFileInfo').style.display = 'none'; audioDropZone.style.display = 'block'; }); }
    function handleAudioFileSelect(file) { const isValidType = file.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i) || file.type.includes('audio/'); if (!isValidType) { alert('请选择音频格式的文件（mp3、wav、m4a、flac、aac、ogg、webm、amr、3gp）'); return; } if (file.size > 10 * 1024 * 1024) { alert('音频文件大小不能超过10MB'); return; } selectedAudioFile = file; document.getElementById('audioFileName').textContent = file.name; document.getElementById('audioFileSize').textContent = formatFileSize(file.size); document.getElementById('audioFileInfo').style.display = 'flex'; document.getElementById('audioDropZone').style.display = 'none'; }
    function initializeTokenConfig() { const tokenRadios = document.querySelectorAll('input[name="tokenOption"]'); const tokenInput = document.getElementById('tokenInput'); tokenRadios.forEach(function(radio) { radio.addEventListener('change', function() { tokenInput.style.display = this.value === 'custom' ? 'block' : 'none'; tokenInput.required = this.value === 'custom'; if (this.value !== 'custom') tokenInput.value = ''; }); }); }
    document.getElementById('transcriptionForm').addEventListener('submit', async function(event) { event.preventDefault(); const transcribeBtn = document.getElementById('transcribeBtn'); const transcriptionResult = document.getElementById('transcriptionResult'); const transcriptionLoading = document.getElementById('transcriptionLoading'); const transcriptionSuccess = document.getElementById('transcriptionSuccess'); const transcriptionError = document.getElementById('transcriptionError'); if (!selectedAudioFile) { alert('请选择要转录的音频文件'); return; } const tokenOption = document.querySelector('input[name="tokenOption"]:checked').value; const customToken = document.getElementById('tokenInput').value; if (tokenOption === 'custom' && !customToken.trim()) { alert('请输入自定义Token'); return; } transcriptionResult.style.display = 'block'; transcriptionLoading.style.display = 'block'; transcriptionSuccess.style.display = 'none'; transcriptionError.style.display = 'none'; transcribeBtn.disabled = true; transcribeBtn.textContent = t('status.transcribing'); document.getElementById('transcriptionProgressInfo').textContent = t('status.fileLabel') + ': ' + selectedAudioFile.name + ' (' + formatFileSize(selectedAudioFile.size) + ')'; try { const formData = new FormData(); formData.append('file', selectedAudioFile); if (tokenOption === 'custom') formData.append('token', customToken); const response = await fetch('/v1/audio/transcriptions', { method: 'POST', body: formData }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error && errorData.error.message ? errorData.error.message : '转录失败'); } const result = await response.json(); document.getElementById('transcriptionText').value = result.text || ''; transcriptionLoading.style.display = 'none'; transcriptionSuccess.style.display = 'block'; } catch (err) { transcriptionLoading.style.display = 'none'; transcriptionError.style.display = 'block'; transcriptionError.textContent = '错误: ' + err.message; } finally { transcribeBtn.disabled = false; transcribeBtn.textContent = t('action.transcribe'); } });
    document.getElementById('copyTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); const button = this; const showCopied = function() { const originalText = button.textContent; button.textContent = t('action.copied'); setTimeout(function() { button.textContent = originalText; }, CONFIG.COPY_FEEDBACK); }; const fallbackCopy = function() { try { transcriptionText.select(); document.execCommand('copy'); showCopied(); } catch (err) { showToast(t('error.copyFailed')); } }; if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(transcriptionText.value).then(showCopied).catch(fallbackCopy); } else { fallbackCopy(); } });
    document.getElementById('editTranscriptionBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText'); transcriptionText.readOnly = !transcriptionText.readOnly; this.textContent = transcriptionText.readOnly ? t('action.edit') : t('action.save'); if (!transcriptionText.readOnly) transcriptionText.focus(); });
    document.getElementById('useForTtsBtn').addEventListener('click', function() { const transcriptionText = document.getElementById('transcriptionText').value; if (!transcriptionText.trim()) { alert('转录结果为空，无法转换为语音'); return; } switchMode('tts'); currentInputMethod = 'text'; document.getElementById('textInputTab').click(); document.getElementById('text').value = transcriptionText; document.getElementById('ttsWorkspace').scrollIntoView({ behavior: 'smooth' }); });
  </script>
</body>
</html>`;
async function handleRequest(request) {
    if (request.method === "OPTIONS") {
        return handleOptions(request);
    }




    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname;

    if (path === "/favicon.ico") {
        return new Response(Uint8Array.from(atob(FAVICON_ICO_BASE64), function(char) { return char.charCodeAt(0); }), {
            headers: {
                "Content-Type": "image/x-icon",
                "Cache-Control": "public, max-age=31536000, immutable",
                ...makeCORSHeaders()
            }
        });
    }

    // 返回前端页面
    if (path === "/" || path === "/index.html") {
        return new Response(HTML_PAGE, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...makeCORSHeaders()
            }
        });
    }

    if (path === "/v1/audio/transcriptions") {
        try {
            return await handleAudioTranscription(request);
        } catch (error) {
            console.error("Audio transcription error:", error);
            return new Response(JSON.stringify({
                error: {
                    message: error.message,
                    type: "api_error",
                    param: null,
                    code: "transcription_error"
                }
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }
    }

    if (path === "/v1/audio/speech") {
        try {
            const contentType = request.headers.get("content-type") || "";
            
            // 处理文件上传
            if (contentType.includes("multipart/form-data")) {
                return await handleFileUpload(request);
            }
            
            // 处理JSON请求（原有功能）
            const requestBody = await request.json();
            const {
                input,
                inputType = "text",
                voice = "zh-CN-XiaoxiaoNeural",
                speed = '1.0',
                volume = '0',
                pitch = '0',
                style = "general"
            } = requestBody;

            if (requestBody.inputType === 'ssml') {
                const audioBlob = await getAudioFromSsml(input, "audio-24khz-48kbitrate-mono-mp3");
                return new Response(audioBlob, {
                    headers: {
                        "Content-Type": "audio/mpeg",
                        "Content-Disposition": "attachment; filename=\"speech.mp3\"",
                        ...makeCORSHeaders()
                    }
                });
            }

            let rate = parseInt(String((parseFloat(speed) - 1.0) * 100));
            let numVolume = parseInt(String(parseFloat(volume) * 100));
            let numPitch = parseInt(pitch);
            const response = await getVoice(
                input,
                voice,
                rate >= 0 ? `+${rate}%` : `${rate}%`,
                numPitch >= 0 ? `+${numPitch}Hz` : `${numPitch}Hz`,
                numVolume >= 0 ? `+${numVolume}%` : `${numVolume}%`,
                style,
                "audio-24khz-48kbitrate-mono-mp3"
            );

            return response;

        } catch (error) {
            console.error("Error:", error);
            return new Response(JSON.stringify({
                error: {
                    message: error.message,
                    type: "api_error",
                    param: null,
                    code: "edge_tts_error"
                }
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }
    }

    // 默认返回 404
    return new Response("Not Found", { status: 404 });
}

export default {
    async fetch(request) {
        return handleRequest(request);
    }
};

async function handleOptions(request) {
    return new Response(null, {
        status: 204,
        headers: {
            ...makeCORSHeaders(),
            "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") || "Authorization"
        }
    });
}

// 添加延迟函数
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 优化文本分块函数
function optimizedTextSplit(text, maxChunkSize = 1500) {
    const chunks = [];
    const sentences = text.split(/[。！？\n]/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;
        
        // 如果单个句子就超过最大长度，按字符分割
        if (trimmedSentence.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            
            // 按字符分割长句子
            for (let i = 0; i < trimmedSentence.length; i += maxChunkSize) {
                chunks.push(trimmedSentence.slice(i, i + maxChunkSize));
            }
        } else if ((currentChunk + trimmedSentence).length > maxChunkSize) {
            // 当前块加上新句子会超过限制，先保存当前块
            if (currentChunk) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = trimmedSentence;
        } else {
            // 添加到当前块
            currentChunk += (currentChunk ? '。' : '') + trimmedSentence;
        }
    }
    
    // 添加最后一个块
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 0);
}

// 批量处理音频块
async function processBatchedAudioChunks(chunks, voiceName, rate, pitch, volume, style, outputFormat, batchSize = 3, delayMs = 1000) {
    const audioChunks = [];
    
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk, index) => {
            try {
                // 为每个请求添加小延迟，避免同时发送
                if (index > 0) {
                    await delay(index * 200);
                }
                return await getAudioChunk(chunk, voiceName, rate, pitch, volume, style, outputFormat);
            } catch (error) {
                console.error(`处理音频块失败 (批次 ${Math.floor(i/batchSize) + 1}, 块 ${index + 1}):`, error);
                throw error;
            }
        });
        
        try {
            const batchResults = await Promise.all(batchPromises);
            audioChunks.push(...batchResults);
            
            // 批次间延迟
            if (i + batchSize < chunks.length) {
                await delay(delayMs);
            }
        } catch (error) {
            console.error(`批次处理失败:`, error);
            throw error;
        }
    }
    
    return audioChunks;
}

async function getVoice(text, voiceName = "zh-CN-XiaoxiaoNeural", rate = '+0%', pitch = '+0Hz', volume = '+0%', style = "general", outputFormat = "audio-24khz-48kbitrate-mono-mp3") {
    try {
        // 文本预处理
        const cleanText = text.trim();
        if (!cleanText) {
            throw new Error("文本内容为空");
        }
        
        // 如果文本很短，直接处理
        if (cleanText.length <= 1500) {
            const audioBlob = await getAudioChunk(cleanText, voiceName, rate, pitch, volume, style, outputFormat);
            return new Response(audioBlob, {
                headers: {
                    "Content-Type": "audio/mpeg",
                    ...makeCORSHeaders()
                }
            });
        }

        // 优化的文本分块
        const chunks = optimizedTextSplit(cleanText, 1500);
        
        // 检查分块数量，防止超过CloudFlare限制
        if (chunks.length > 40) {
            throw new Error(`文本过长，分块数量(${chunks.length})超过限制。请缩短文本或分批处理。`);
        }
        
        console.log(`文本已分为 ${chunks.length} 个块进行处理`);

        // 批量处理音频块，控制并发数量和频率
        const audioChunks = await processBatchedAudioChunks(
            chunks, 
            voiceName, 
            rate, 
            pitch, 
            volume, 
            style, 
            outputFormat,
            3,  // 每批处理3个
            800 // 批次间延迟800ms
        );

        // 将音频片段拼接起来
        const concatenatedAudio = new Blob(audioChunks, { type: 'audio/mpeg' });
        return new Response(concatenatedAudio, {
            headers: {
                "Content-Type": "audio/mpeg",
                ...makeCORSHeaders()
            }
        });

    } catch (error) {
        console.error("语音合成失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: error.message || String(error),
                type: "api_error",
                param: `${voiceName}, ${rate}, ${pitch}, ${volume}, ${style}, ${outputFormat}`,
                code: "edge_tts_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}



async function getAudioFromSsml(ssml, outputFormat = 'audio-24khz-48kbitrate-mono-mp3', maxRetries = 3) {
    const retryDelay = 500;
    const cleanSsml = String(ssml || '').trim();
    if (!cleanSsml) {
        throw new Error("SSML内容为空");
    }
    if (!/<speak[\s>]/i.test(cleanSsml)) {
        throw new Error("SSML必须包含<speak>根元素");
    }
    if (cleanSsml.length > 20000) {
        throw new Error("SSML内容过长，最大支持20000字符");
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const endpoint = await getEndpoint();
            const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": endpoint.t,
                    "Content-Type": "application/ssml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                    "X-Microsoft-OutputFormat": outputFormat
                },
                body: cleanSsml
            });

            if (!response.ok) {
                const errorText = await response.text();
                if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
                    await delay(retryDelay * (attempt + 1));
                    continue;
                }
                throw new Error(`Edge TTS SSML API错误: ${response.status} ${errorText}`);
            }

            return await response.blob();
        } catch (error) {
            if (attempt === maxRetries) {
                throw new Error(`SSML音频生成失败（已重试${maxRetries}次）: ${error.message}`);
            }
            if (error.message.includes('fetch') || error.message.includes('network')) {
                await delay(retryDelay * (attempt + 1));
                continue;
            }
            throw error;
        }
    }
}

//获取单个音频数据（增强错误处理和重试机制）
async function getAudioChunk(text, voiceName, rate, pitch, volume, style, outputFormat = 'audio-24khz-48kbitrate-mono-mp3', maxRetries = 3) {
    const retryDelay = 500; // 重试延迟500ms
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const endpoint = await getEndpoint();
            const url = `https://${endpoint.r}.tts.speech.microsoft.com/cognitiveservices/v1`;
            
            // 处理文本中的延迟标记
            let m = text.match(/\[(\d+)\]\s*?$/);
            let slien = 0;
            if (m && m.length == 2) {
                slien = parseInt(m[1]);
                text = text.replace(m[0], '');
            }
            
            // 验证文本长度
            if (!text.trim()) {
                throw new Error("文本块为空");
            }
            
            if (text.length > 2000) {
                throw new Error(`文本块过长: ${text.length} 字符，最大支持2000字符`);
            }
            
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": endpoint.t,
                    "Content-Type": "application/ssml+xml",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                    "X-Microsoft-OutputFormat": outputFormat
                },
                body: getSsml(text, voiceName, rate, pitch, volume, style, slien)
            });

            if (!response.ok) {
                const errorText = await response.text();
                
                // 根据错误类型决定是否重试
                if (response.status === 429) {
                    // 频率限制，需要重试
                    if (attempt < maxRetries) {
                        console.log(`频率限制，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                        await delay(retryDelay * (attempt + 1));
                        continue;
                    }
                    throw new Error(`请求频率过高，已重试${maxRetries}次仍失败`);
                } else if (response.status >= 500) {
                    // 服务器错误，可以重试
                    if (attempt < maxRetries) {
                        console.log(`服务器错误，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                        await delay(retryDelay * (attempt + 1));
                        continue;
                    }
                    throw new Error(`Edge TTS服务器错误: ${response.status} ${errorText}`);
                } else {
                    // 客户端错误，不重试
                    throw new Error(`Edge TTS API错误: ${response.status} ${errorText}`);
                }
            }

            return await response.blob();
            
        } catch (error) {
            if (attempt === maxRetries) {
                // 最后一次重试失败
                throw new Error(`音频生成失败（已重试${maxRetries}次）: ${error.message}`);
            }
            
            // 如果是网络错误或其他可重试错误
            if (error.message.includes('fetch') || error.message.includes('network')) {
                console.log(`网络错误，第${attempt + 1}次重试，等待${retryDelay * (attempt + 1)}ms`);
                await delay(retryDelay * (attempt + 1));
                continue;
            }
            
            // 其他错误直接抛出
            throw error;
        }
    }
}

// XML文本转义函数
function escapeXmlText(text) {
    return text
        .replace(/&/g, '&amp;')   // 必须首先处理 &
        .replace(/</g, '&lt;')    // 处理 <
        .replace(/>/g, '&gt;')    // 处理 >
        .replace(/"/g, '&quot;')  // 处理 "
        .replace(/'/g, '&apos;'); // 处理 '
}

function getSsml(text, voiceName, rate, pitch, volume, style, slien = 0) {
    // 对文本进行XML转义
    const escapedText = escapeXmlText(text);
    
    let slien_str = '';
    if (slien > 0) {
        slien_str = `<break time="${slien}ms" />`
    }
    return `<speak xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" version="1.0" xml:lang="zh-CN"> 
                <voice name="${voiceName}"> 
                    <mstts:express-as style="${style}"  styledegree="2.0" role="default" > 
                        <prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escapedText}</prosody> 
                    </mstts:express-as> 
                    ${slien_str}
                </voice> 
            </speak>`;

}

async function getEndpoint() {
    const now = Date.now() / 1000;

    if (tokenInfo.token && tokenInfo.expiredAt && now < tokenInfo.expiredAt - TOKEN_REFRESH_BEFORE_EXPIRY) {
        return tokenInfo.endpoint;
    }

    // 获取新token
    const endpointUrl = "https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0";
    const clientId = crypto.randomUUID().replace(/-/g, "");

    try {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Accept-Language": "zh-Hans",
                "X-ClientVersion": "4.0.530a 5fe1dc6c",
                "X-UserId": "0f04d16a175c411e",
                "X-HomeGeographicRegion": "zh-Hans-CN",
                "X-ClientTraceId": clientId,
                "X-MT-Signature": await sign(endpointUrl),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": "0",
                "Accept-Encoding": "gzip"
            }
        });

        if (!response.ok) {
            throw new Error(`获取endpoint失败: ${response.status}`);
        }

        const data = await response.json();
        const jwt = data.t.split(".")[1];
        const decodedJwt = JSON.parse(atob(jwt));

        tokenInfo = {
            endpoint: data,
            token: data.t,
            expiredAt: decodedJwt.exp
        };

        return data;

    } catch (error) {
        console.error("获取endpoint失败:", error);
        // 如果有缓存的token，即使过期也尝试使用
        if (tokenInfo.token) {
            console.log("使用过期的缓存token");
            return tokenInfo.endpoint;
        }
        throw error;
    }
}



function makeCORSHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Max-Age": "86400"
    };
}

async function hmacSha256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key,
        { name: "HMAC", hash: { name: "SHA-256" } },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
    return new Uint8Array(signature);
}

async function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function bytesToBase64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes));
}

function uuid() {
    return crypto.randomUUID().replace(/-/g, "");
}

async function sign(urlStr) {
    const url = urlStr.split("://")[1];
    const encodedUrl = encodeURIComponent(url);
    const uuidStr = uuid();
    const formattedDate = dateFormat();
    const bytesToSign = `MSTranslatorAndroidApp${encodedUrl}${formattedDate}${uuidStr}`.toLowerCase();
    const decode = await base64ToBytes("oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==");
    const signData = await hmacSha256(decode, bytesToSign);
    const signBase64 = await bytesToBase64(signData);
    return `MSTranslatorAndroidApp::${signBase64}::${formattedDate}::${uuidStr}`;
}

function dateFormat() {
    const formattedDate = (new Date()).toUTCString().replace(/GMT/, "").trim() + " GMT";
    return formattedDate.toLowerCase();
}

// 处理文件上传的函数
async function handleFileUpload(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const voice = formData.get('voice') || 'zh-CN-XiaoxiaoNeural';
        const speed = formData.get('speed') || '1.0';
        const volume = formData.get('volume') || '0';
        const pitch = formData.get('pitch') || '0';
        const style = formData.get('style') || 'general';

        // 验证文件
        if (!file) {
            return new Response(JSON.stringify({
                error: {
                    message: "未找到上传的文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "missing_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件类型
        if (!file.type.includes('text/') && !file.name.toLowerCase().endsWith('.txt')) {
            return new Response(JSON.stringify({
                error: {
                    message: "不支持的文件类型，请上传txt文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "invalid_file_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件大小（限制为500KB）
        if (file.size > 500 * 1024) {
            return new Response(JSON.stringify({
                error: {
                    message: "文件大小超过限制（最大500KB）",
                    type: "invalid_request_error",
                    param: "file",
                    code: "file_too_large"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 读取文件内容
        const text = await file.text();
        
        // 验证文本内容
        if (!text.trim()) {
            return new Response(JSON.stringify({
                error: {
                    message: "文件内容为空",
                    type: "invalid_request_error",
                    param: "file",
                    code: "empty_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 文本长度限制（10000字符）
        if (text.length > 10000) {
            return new Response(JSON.stringify({
                error: {
                    message: "文本内容过长（最大10000字符）",
                    type: "invalid_request_error",
                    param: "file",
                    code: "text_too_long"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 处理参数格式，与原有逻辑保持一致
        let rate = parseInt(String((parseFloat(speed) - 1.0) * 100));
        let numVolume = parseInt(String(parseFloat(volume) * 100));
        let numPitch = parseInt(pitch);

        // 调用TTS服务
        return await getVoice(
            text,
            voice,
            rate >= 0 ? `+${rate}%` : `${rate}%`,
            numPitch >= 0 ? `+${numPitch}Hz` : `${numPitch}Hz`,
            numVolume >= 0 ? `+${numVolume}%` : `${numVolume}%`,
            style,
            "audio-24khz-48kbitrate-mono-mp3"
        );

    } catch (error) {
        console.error("文件上传处理失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: "文件处理失败",
                type: "api_error",
                param: null,
                code: "file_processing_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}

// 处理语音转录的函数
async function handleAudioTranscription(request) {
    try {
        // 验证请求方法
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({
                error: {
                    message: "只支持POST方法",
                    type: "invalid_request_error",
                    param: "method",
                    code: "method_not_allowed"
                }
            }), {
                status: 405,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        const contentType = request.headers.get("content-type") || "";
        
        // 验证Content-Type
        if (!contentType.includes("multipart/form-data")) {
            return new Response(JSON.stringify({
                error: {
                    message: "请求必须使用multipart/form-data格式",
                    type: "invalid_request_error",
                    param: "content-type",
                    code: "invalid_content_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 解析FormData
        const formData = await request.formData();
        const audioFile = formData.get('file');
        const customToken = formData.get('token');

        // 验证音频文件
        if (!audioFile) {
            return new Response(JSON.stringify({
                error: {
                    message: "未找到音频文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "missing_file"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证文件大小（限制为10MB）
        if (audioFile.size > 10 * 1024 * 1024) {
            return new Response(JSON.stringify({
                error: {
                    message: "音频文件大小不能超过10MB",
                    type: "invalid_request_error",
                    param: "file",
                    code: "file_too_large"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 验证音频文件格式
        const allowedTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac',
            'audio/ogg', 'audio/webm', 'audio/amr', 'audio/3gpp'
        ];
        
        const isValidType = allowedTypes.some(type => 
            audioFile.type.includes(type) || 
            audioFile.name.toLowerCase().match(/\.(mp3|wav|m4a|flac|aac|ogg|webm|amr|3gp)$/i)
        );

        if (!isValidType) {
            return new Response(JSON.stringify({
                error: {
                    message: "不支持的音频文件格式，请上传mp3、wav、m4a、flac、aac、ogg、webm、amr或3gp格式的文件",
                    type: "invalid_request_error",
                    param: "file",
                    code: "invalid_file_type"
                }
            }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 使用默认token或用户提供的token
        const token = customToken || 'sk-wtldsvuprmwltxpbspbmawtolbacghzawnjhtlzlnujjkfhh';

        // 构建发送到硅基流动API的FormData
        const apiFormData = new FormData();
        apiFormData.append('file', audioFile);
        apiFormData.append('model', 'FunAudioLLM/SenseVoiceSmall');

        // 发送请求到硅基流动API
        const apiResponse = await fetch('https://api.siliconflow.cn/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: apiFormData
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('硅基流动API错误:', apiResponse.status, errorText);
            
            let errorMessage = '语音转录服务暂时不可用';
            
            if (apiResponse.status === 401) {
                errorMessage = 'API Token无效，请检查您的配置';
            } else if (apiResponse.status === 429) {
                errorMessage = '请求过于频繁，请稍后再试';
            } else if (apiResponse.status === 413) {
                errorMessage = '音频文件太大，请选择较小的文件';
            }

            return new Response(JSON.stringify({
                error: {
                    message: errorMessage,
                    type: "api_error",
                    param: null,
                    code: "transcription_api_error"
                }
            }), {
                status: apiResponse.status,
                headers: {
                    "Content-Type": "application/json",
                    ...makeCORSHeaders()
                }
            });
        }

        // 获取转录结果
        const transcriptionResult = await apiResponse.json();

        // 返回转录结果
        return new Response(JSON.stringify(transcriptionResult), {
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });

    } catch (error) {
        console.error("语音转录处理失败:", error);
        return new Response(JSON.stringify({
            error: {
                message: "语音转录处理失败",
                type: "api_error",
                param: null,
                code: "transcription_processing_error"
            }
        }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                ...makeCORSHeaders()
            }
        });
    }
}

