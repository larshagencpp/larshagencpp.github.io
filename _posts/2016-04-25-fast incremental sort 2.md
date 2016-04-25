---
layout: post
title: "Fast incremental sort 2, priority queues and small scale"
---

In my last [post](/blog/2016/04/23/fast-incremental-sort), I talked about how to incrementally sort values with a modification of the incremental quicksort algorithm. I have gotten a lot of great feedback on that post, and I wanted to share the results of some additional experiements that readers suggested.

**Priority Queue**

A lot of people suggested using a [priority queue](https://en.wikipedia.org/wiki/Priority_queue) to solve the problem, and that seems like a natural thing to do. The approach is naturally incremental, each item popped from the queue is the next element in the sorted sequence. Using a standard binary heap, we only need $$O(N)$$ time to set up the queue, which is optimal.

The problem with priority queues, however, is that the time taken to remove each element from the queue is typically $$O(\log N)$$, not $$O(\log k)$$ as is the optimal for incremental sorting (I'm assuming a simple binary heap implementation or similar). Thus we are spending too much time maintaining the heap property of the large range. In fact, the original [paper](http://personales.dcc.uchile.cl/~raparede/publ/06alenexIQS.pdf) on incremental quicksort showed how the algorithm sped up [Kruskal's algorithm](https://en.wikipedia.org/wiki/Kruskal%27s_algorithm) compared to a version using a priority queue.

All those reasons aside, it's always safest to measure. To implement a heap sorter in C++, I used the standard heap algorithms. The standard C++ heap algorithms assume a max heap rooted at the beginning of the range, which wouldn't really work. Thankfully, by passing <code>std::reverse_iterator</code>s we get the root of the heap at the end, and by using <code>std::greater</code> as the comparator, we get a min heap. Since this min heap will spit out the smallest element at the beginning of its range, we can call it each time we want a new item in the sequence.

{% highlight c++ %}
template<typename I>
class heap_sorter {
public:
  heap_sorter(I i1, I i2) : first(i1), last(i2) {}

  class iterator {
  public:
    ...
    iterator(I first, I last)
	  :
	  current(std::make_reverse_iterator(first)),
	  end(std::make_reverse_iterator(last))
	{
      std::make_heap(end, current, std::greater<>());
      extract_current();
    }
    bool operator==(const iterator& o) const { return current == o.current; }
    bool operator!=(const iterator& o) const { return current != o.current; }
    iterator& operator++() {
      --current;
      extract_current();
      return *this;
    }

    value_type& operator*() {
      return *(current - 1);
    }

  private:
    void extract_current() {
      if (current != end) {
        std::pop_heap(end, current, std::greater<>());
      }
    }
    std::reverse_iterator<I> current;
    std::reverse_iterator<I> end;
  };

  iterator begin() {
    return iterator(first, last);
  }

  iterator end() {
    return iterator(last, last);
  }

private:
  I first;
  I last;
};
{% endhighlight %}

As we can see, the heap sorter does solve the problem, and is faster than doing a full sort for small and medium $$k$$, but it's not really a competitor against the incremental quicksort based sorts. If I have missed some simple way to optimize the heap sort, please let me know.

{% include plot.html divid="heapsortmsvc" csvpath="/project/incremental_sort/heap_sorter_msvc.csv" title="Heap Sorting" ytitle="Time(ms)" suffix="ms" %}

**Smaller Scale**

I was also asked why I had chosen the rather arbitrary scale of $$N=10^7$$. I didn't have a really good answer, so I thought I would try out for some smaller values of $$N$$, to see if anything interesting happens.

{% include plot.html divid="ss1000000msvc" csvpath="/project/incremental_sort/small_scale_1000000_msvc.csv" title="N=1,000,000" ytitle="Time(ms)" suffix="ms" %}
{% include plot.html divid="ss100000msvc" csvpath="/project/incremental_sort/small_scale_100000_msvc.csv" title="N=100,000" ytitle="Time(ms)" suffix="ms" %}
{% include plot.html divid="ss10000msvc" csvpath="/project/incremental_sort/small_scale_10000_msvc.csv" title="N=10,000" ytitle="Time(ms)" suffix="ms" %}
{% include plot.html divid="ss1000msvc" csvpath="/project/incremental_sort/small_scale_1000_msvc.csv" title="N=1,000" ytitle="Time(ms)" suffix="ms" %}
{% include plot.html divid="ss100msvc" csvpath="/project/incremental_sort/small_scale_100_msvc.csv" title="N=100" ytitle="Time(ms)" suffix="ms" %}

I really don't know if these microsesecond level measurements are reliable, as they were not what I intended to measure when I wrote the original timer code. Anyway, I think we can see a pattern. My custom sorters have a certain startup cost, that starts making a difference at $$N\le 1000$$. The heap based sorter seems to an excellent choice for that case. For $$N\ge 10^4$$, skewed incremental quicksort seems like the best option.

An interesting next step is to if it's possible to make a sorter that behaves like the heap sorter for small $$N$$, and like the skewed incremental quicksort for large $$N$$. I would guess the main challenge is to avoid the overhead over switching between two possible implementations.